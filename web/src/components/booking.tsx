"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  BookingError,
  type BookingConfirmation,
  type BookingPage,
  type PublicService,
} from "@/application/ports/booking";
import {
  addMonths,
  buildMonthGrid,
  describeDateInFull,
  describeInstant,
  describeMonth,
  formatDuration,
  monthOf,
  WEEKDAY_LABELS,
  type BookingCalendar,
} from "@/application/use-cases/booking-calendar";
import { firstInvalidField, type BookingFormField } from "@/application/use-cases/validate-booking-form";
import { bookingGateway } from "@/config/booking";
import {
  AlertIcon,
  ArrowIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CoinIcon,
  SparkleIcon,
  SpinnerIcon,
  UserIcon,
} from "./icons";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Rótulo do segmento, espelhando o catálogo da API.
 *
 * A cópia é curta e a lista quase não muda; segmento desconhecido simplesmente
 * não aparece, em vez de mostrar `nails` para a cliente.
 */
const SEGMENT_LABEL: Record<string, string> = {
  nails: "Unhas",
  lashes: "Cílios",
  brows: "Sobrancelhas",
  hair: "Cabelo",
  esthetics: "Estética",
  makeup: "Maquiagem",
  waxing: "Depilação",
};

/**
 * Estados exigidos pelo item C-06, aplicados à lista de horários.
 *
 * `success` com lista vazia é dia sem vaga — estado vazio, e não erro. A
 * distinção importa: a cliente que vê "algo deu errado" acha que o link está
 * quebrado e desiste; a que vê "esse dia está cheio" toca no dia seguinte.
 */
type SlotsState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; slots: string[] };

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "error"; message: string; field?: BookingFormField };

/** Passo que recebe o foco quando aparece. */
type Step = "day" | "slot" | "form";

/** Campo que a API reprovou apontando para o campo da tela. */
const FIELD_OF: Record<string, BookingFormField> = {
  clientName: "clientName",
  clientPhone: "clientPhone",
};

export function BookingFlow({
  slug,
  page,
  calendar,
}: {
  slug: string;
  page: BookingPage;
  calendar: BookingCalendar;
}) {
  const id = useId();
  const field = (name: string) => `${id}-${name}`;

  const [service, setService] = useState<PublicService | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotsState>({ status: "empty" });
  /** Muda de valor para forçar a releitura dos horários depois de um 409. */
  const [reload, setReload] = useState(0);
  const [taken, setTaken] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  /** Agenda desligada ou link trocado no meio do caminho: a página inteira muda. */
  const [gone, setGone] = useState<string | null>(null);

  /**
   * Relógio do aparelho, lido só no navegador.
   *
   * No servidor não existe: quem renderiza é a hospedagem, e o fuso dela não
   * diz nada sobre onde a cliente está. Daí o instantâneo nulo do lado do
   * servidor, que faz o aviso nascer escondido e aparecer depois da
   * hidratação, sem descompasso entre as duas árvores.
   */
  const deviceTimeZone = useSyncExternalStore(
    subscribeToNothing,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );

  const dayRef = useRef<HTMLHeadingElement>(null);
  const slotRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLHeadingElement>(null);

  /**
   * O foco vai para o passo aberto depois da renderização, e não dentro do
   * manipulador do toque: o passo só existe no DOM depois que a tela é
   * desenhada, e o caminho do 409 ainda passa por uma resposta da rede antes de
   * mudar de passo. Fica em referência, e não em estado, porque é intenção de
   * uma vez só — virar estado renderizaria a tela de novo à toa.
   */
  const pendingFocus = useRef<Step | null>(null);
  useEffect(() => {
    const step = pendingFocus.current;
    if (!step) return;
    pendingFocus.current = null;
    ({ day: dayRef, slot: slotRef, form: formRef })[step].current?.focus();
  });

  useEffect(() => {
    if (!service || !date) return;

    const controller = new AbortController();

    bookingGateway
      .slots(slug, service.id, date, controller.signal)
      .then((availability) => setSlots({ status: "success", slots: availability.slots }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof BookingError && error.code === "not_found") {
          setGone(error.message);
          return;
        }
        setSlots({
          status: "error",
          message:
            error instanceof BookingError
              ? error.message
              : "Não conseguimos carregar os horários agora.",
        });
      });

    return () => controller.abort();
  }, [slug, service, date, reload]);

  if (gone) return <UnavailableNotice message={gone} />;

  if (confirmation && service) {
    return <ConfirmationCard page={page} service={service} confirmation={confirmation} />;
  }

  /**
   * O estado de carregamento é marcado aqui, no toque, e não dentro do efeito
   * que busca: assim a lista antiga some no mesmo quadro em que a escolha muda,
   * e a cliente nunca vê horários de um dia sob o título de outro.
   */
  const chooseService = (chosen: PublicService) => {
    // Tocar de novo no que já está escolhido não é uma escolha nova. Sem esta
    // saída, o "procurando horários" ficaria girando para sempre: a busca só
    // roda quando o serviço ou o dia mudam de verdade.
    if (chosen.id === service?.id) {
      dayRef.current?.focus();
      return;
    }

    setService(chosen);
    // A duração muda com o serviço, então o horário escolhido para o anterior
    // pode nem existir mais. O dia continua valendo.
    setTime(null);
    setTaken(null);
    setSubmit({ status: "idle" });
    if (date) setSlots({ status: "loading" });
    pendingFocus.current = "day";
  };

  const chooseDay = (chosen: string) => {
    if (chosen === date) {
      slotRef.current?.focus();
      return;
    }

    setDate(chosen);
    setTime(null);
    setTaken(null);
    setSubmit({ status: "idle" });
    setSlots({ status: "loading" });
    pendingFocus.current = "slot";
  };

  const chooseTime = (chosen: string) => {
    setTime(chosen);
    setTaken(null);
    setSubmit({ status: "idle" });
    pendingFocus.current = "form";
  };

  const reloadSlots = () => {
    setSlots({ status: "loading" });
    setReload((current) => current + 1);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!service || !date || !time || submit.status === "sending") return;

    const problem = firstInvalidField({ clientName, clientPhone });
    if (problem) {
      setSubmit({ status: "error", message: problem.message, field: problem.field });
      document.getElementById(field(problem.field))?.focus();
      return;
    }

    setSubmit({ status: "sending" });
    setTaken(null);

    try {
      const booked = await bookingGateway.book(slug, {
        serviceId: service.id,
        date,
        time,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setConfirmation(booked);
      setSubmit({ status: "idle" });
      return;
    } catch (error) {
      if (!(error instanceof BookingError)) {
        setSubmit({ status: "error", message: "Não conseguimos marcar agora. Tente de novo." });
        return;
      }

      if (error.code === "not_found") {
        setGone(error.message);
        return;
      }

      /**
       * O caso que acontece de verdade: entre ver a lista e confirmar, alguém
       * pegou o horário. Só a escolha do horário é desfeita — que é justamente
       * o que deixou de valer. Nome, telefone e observação continuam onde
       * estão, guardados fora deste passo, e reaparecem preenchidos assim que
       * ela escolher outro horário. A lista é lida de novo para que a próxima
       * escolha seja sobre o que existe agora, e não sobre o que existia
       * quando a página abriu.
       */
      if (error.code === "conflict") {
        setTime(null);
        setTaken(error.message);
        setSubmit({ status: "idle" });
        reloadSlots();
        pendingFocus.current = "slot";
        return;
      }

      const guilty = error.field ? FIELD_OF[error.field] : undefined;
      setSubmit({ status: "error", message: error.message, field: guilty });
      if (guilty) document.getElementById(field(guilty))?.focus();
    }
  };

  const errorId = `${id}-erro`;
  const phoneHintId = `${field("clientPhone")}-ajuda`;
  const businessName = page.businessName?.trim() || null;
  const segment = SEGMENT_LABEL[page.segment];
  const invalidName = submit.status === "error" && submit.field === "clientName";
  const invalidPhone = submit.status === "error" && submit.field === "clientPhone";

  return (
    <div className="booking-shell">
      <header className="booking-head">
        {segment && (
          <span className="eyebrow">
            <SparkleIcon /> {segment}
          </span>
        )}
        <h1>{businessName ? `Agende com ${businessName}` : "Agende seu horário"}</h1>
        <p>Escolha o serviço, o dia e o horário. Não precisa criar conta.</p>
      </header>

      <section className="booking-step" aria-labelledby={`${id}-servico`}>
        <StepTitle number={1} id={`${id}-servico`} title="Qual serviço você quer?" />

        {page.services.length === 0 ? (
          <EmptyBox>
            Esta agenda ainda não tem serviços abertos para marcar pelo link. Fale com{" "}
            {businessName ?? "a profissional"} para combinar seu horário.
          </EmptyBox>
        ) : (
          <ul className="booking-options" aria-labelledby={`${id}-servico`}>
            {page.services.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="service-option"
                  aria-pressed={service?.id === option.id}
                  onClick={() => chooseService(option)}
                >
                  <span className="service-name">{option.name}</span>
                  <span className="service-meta">
                    <span>
                      <ClockIcon /> {formatDuration(option.durationMinutes)}
                    </span>
                    <span>
                      <CoinIcon /> {money.format(option.priceCents / 100)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {service && (
        <section className="booking-step" aria-labelledby={`${id}-dia`}>
          <StepTitle number={2} id={`${id}-dia`} title="Que dia fica bom?" heading={dayRef} />

          <MonthCalendar calendar={calendar} selected={date} onSelect={chooseDay} />
        </section>
      )}

      {service && date && (
        <section className="booking-step" aria-labelledby={`${id}-horario`}>
          <StepTitle
            number={3}
            id={`${id}-horario`}
            title="Escolha o horário"
            heading={slotRef}
            note={describeDateInFull(date)}
          />

          {taken && (
            <p className="form-error" role="alert">
              <AlertIcon /> {taken}
            </p>
          )}

          <div aria-live="polite" aria-busy={slots.status === "loading"}>
            {slots.status === "loading" && <LoadingBox>Procurando horários livres…</LoadingBox>}

            {slots.status === "error" && (
              <div className="booking-retry">
                <p className="form-error">
                  <AlertIcon /> {slots.message}
                </p>
                <button type="button" className="secondary-button" onClick={reloadSlots}>
                  Tentar de novo
                </button>
              </div>
            )}

            {slots.status === "success" && slots.slots.length === 0 && (
              <EmptyBox>
                Nenhum horário livre nesse dia. Toque em outro dia acima — costuma haver vaga logo
                em seguida.
              </EmptyBox>
            )}

            {slots.status === "success" && slots.slots.length > 0 && (
              <ul className="slot-grid" aria-labelledby={`${id}-horario`}>
                {slots.slots.map((option) => (
                  <li key={option}>
                    <button
                      type="button"
                      className="slot-option"
                      aria-pressed={time === option}
                      onClick={() => chooseTime(option)}
                    >
                      {option}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {deviceTimeZone && deviceTimeZone !== page.timezone && (
            <p className="booking-note">
              Os horários estão no relógio de quem atende (fuso {page.timezone}), que é diferente
              do relógio do seu aparelho.
            </p>
          )}
        </section>
      )}

      {service && date && time && (
        <section className="booking-step" aria-labelledby={`${id}-dados`}>
          <StepTitle
            number={4}
            id={`${id}-dados`}
            title="Seus dados"
            heading={formRef}
            note="Para a profissional saber quem vai atender."
          />

          <form className="booking-form" noValidate onSubmit={send}>
            <div className="field">
              <label htmlFor={field("clientName")}>Seu nome</label>
              <div className={`input-wrap ${invalidName ? "is-invalid" : ""}`}>
                <input
                  id={field("clientName")}
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  value={clientName}
                  aria-invalid={invalidName || undefined}
                  aria-describedby={invalidName ? errorId : undefined}
                  onChange={(event) => setClientName(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={field("clientPhone")}>Telefone com DDD</label>
              <div className={`input-wrap ${invalidPhone ? "is-invalid" : ""}`}>
                <input
                  id={field("clientPhone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={20}
                  placeholder="95 99999-0000"
                  value={clientPhone}
                  aria-invalid={invalidPhone || undefined}
                  aria-describedby={invalidPhone ? `${phoneHintId} ${errorId}` : phoneHintId}
                  onChange={(event) => setClientPhone(event.target.value)}
                />
              </div>
              <small id={phoneHintId} className="field-hint">
                É por aqui que a profissional fala com você se algo mudar.
              </small>
            </div>

            <div className="field">
              <label htmlFor={field("notes")}>Quer avisar alguma coisa? (opcional)</label>
              <textarea
                id={field("notes")}
                rows={3}
                maxLength={300}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <BookingSummary service={service} date={date} time={time} businessName={businessName} />

            {submit.status === "error" && (
              <p className="form-error" id={errorId} role="alert">
                <AlertIcon /> {submit.message}
              </p>
            )}

            <button
              className="primary-button wide"
              type="submit"
              disabled={submit.status === "sending"}
            >
              {submit.status === "sending" ? (
                <>
                  Confirmando <SpinnerIcon className="spinning" />
                </>
              ) : (
                <>
                  Confirmar agendamento <ArrowIcon />
                </>
              )}
            </button>
            <p className="form-note">Seus dados vão só para quem vai te atender.</p>
          </form>
        </section>
      )}
    </div>
  );
}

function StepTitle({
  number,
  id,
  title,
  note,
  heading,
}: {
  number: number;
  id: string;
  title: string;
  note?: string;
  heading?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="step-title">
      <span aria-hidden="true">{number}</span>
      <div>
        {/* `tabIndex` negativo para receber foco só por programa: é assim que o
            passo recém-aberto é anunciado a quem usa leitor de tela. */}
        <h2 id={id} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        {note && <small>{note}</small>}
      </div>
    </div>
  );
}

/**
 * Calendário do mês, com as setas limitadas ao que a agenda aceita.
 *
 * O mês exibido é estado da tela, e não da escolha: quem abre novembro e volta
 * para outubro sem clicar em nada não perde o dia que já tinha marcado.
 */
function MonthCalendar({
  calendar,
  selected,
  onSelect,
}: {
  calendar: BookingCalendar;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(calendar.month);

  const weeks = buildMonthGrid(month, calendar);
  const previous = month > monthOf(calendar.first) ? addMonths(month, -1) : null;
  const next = month < monthOf(calendar.last) ? addMonths(month, 1) : null;

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-nav calendar-nav-back"
          onClick={() => previous && setMonth(previous)}
          disabled={previous === null}
          aria-label="Mês anterior"
        >
          <ArrowIcon />
        </button>
        {/* A leitora de tela anuncia a troca de mês; sem isso a seta parece não
            ter feito nada para quem não vê a grade mudar. */}
        <strong className="calendar-month" aria-live="polite">
          {describeMonth(month)}
        </strong>
        <button
          type="button"
          className="calendar-nav"
          onClick={() => next && setMonth(next)}
          disabled={next === null}
          aria-label="Próximo mês"
        >
          <ArrowIcon />
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="calendar-weekday" aria-hidden="true">
            {label}
          </span>
        ))}

        {weeks.map((week, index) =>
          week.map((day, position) =>
            day === null ? (
              <span key={`${index}-${position}`} className="calendar-blank" aria-hidden="true" />
            ) : (
              <button
                key={day.date}
                type="button"
                className="calendar-day"
                disabled={!day.selectable}
                aria-pressed={selected === day.date}
                // O número sozinho não diz que dia é; o rótulo por extenso diz.
                aria-label={describeDateInFull(day.date)}
                onClick={() => onSelect(day.date)}
              >
                {day.day}
              </button>
            ),
          ),
        )}
      </div>
    </div>
  );
}

function BookingSummary({
  service,
  date,
  time,
  businessName,
}: {
  service: PublicService;
  date: string;
  time: string;
  businessName: string | null;
}) {
  return (
    <dl className="booking-summary">
      <div>
        <dt>Serviço</dt>
        <dd>{service.name}</dd>
      </div>
      <div>
        <dt>Quando</dt>
        <dd>
          {describeDateInFull(date)} às {time}
        </dd>
      </div>
      <div>
        <dt>Duração</dt>
        <dd>{formatDuration(service.durationMinutes)}</dd>
      </div>
      <div>
        <dt>Valor</dt>
        <dd>{money.format(service.priceCents / 100)}</dd>
      </div>
      {businessName && (
        <div>
          <dt>Com</dt>
          <dd>{businessName}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Comprovante.
 *
 * Não existe e-mail nem mensagem automática no MVP: esta tela é tudo o que a
 * cliente leva. Por isso ela repete o que foi marcado, quando e com quem, em
 * vez de só dizer "pronto".
 */
function ConfirmationCard({
  page,
  service,
  confirmation,
}: {
  page: BookingPage;
  service: PublicService;
  confirmation: BookingConfirmation;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const businessName = page.businessName?.trim() || null;

  // Sem isto, quem usa leitor de tela continuaria ouvindo o formulário que
  // acabou de sumir e não saberia que o agendamento foi confirmado.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="booking-shell">
      <div className="booking-done">
        <span className="booking-done-mark" aria-hidden="true">
          <CheckIcon />
        </span>
        <h1 ref={heading} tabIndex={-1}>
          Agendamento confirmado
        </h1>
        <p>
          {confirmation.clientName}, seu horário está reservado
          {businessName ? ` com ${businessName}` : ""}.
        </p>

        <dl className="booking-summary">
          <div>
            <dt>
              <CalendarIcon /> Quando
            </dt>
            <dd>{describeInstant(confirmation.startsAt, page.timezone)}</dd>
          </div>
          <div>
            <dt>
              <SparkleIcon /> Serviço
            </dt>
            <dd>{service.name}</dd>
          </div>
          <div>
            <dt>
              <ClockIcon /> Duração
            </dt>
            <dd>{formatDuration(confirmation.durationMinutes)}</dd>
          </div>
          <div>
            <dt>
              <CoinIcon /> Valor
            </dt>
            <dd>{money.format(service.priceCents / 100)}</dd>
          </div>
          <div>
            <dt>
              <UserIcon /> Em nome de
            </dt>
            <dd>{confirmation.clientName}</dd>
          </div>
        </dl>

        <p className="booking-note">
          Guarde esta tela ou tire uma foto dela: é o seu comprovante. Se precisar remarcar ou
          desmarcar, fale direto com {businessName ?? "a profissional"}.
        </p>
      </div>
    </div>
  );
}

function UnavailableNotice({ message }: { message: string }) {
  return (
    <div className="booking-shell">
      <div className="booking-gone">
        <span className="booking-done-mark muted" aria-hidden="true">
          <CalendarIcon />
        </span>
        <h1>Link indisponível</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <p className="booking-empty">
      <CalendarIcon />
      <span>{children}</span>
    </p>
  );
}

/** O fuso do aparelho não muda no meio da visita: não há o que assinar. */
function subscribeToNothing() {
  return () => {};
}

function LoadingBox({ children }: { children: ReactNode }) {
  return (
    <p className="booking-loading">
      <SpinnerIcon className="spinning" />
      <span>{children}</span>
    </p>
  );
}
