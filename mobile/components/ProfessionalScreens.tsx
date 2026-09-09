import { colors } from '../theme';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MATERIAL_CATEGORIES, UNITS, guessMaterialCategory, labelOf, slugOf } from '../lib/catalog';
import type { Material } from '../lib/resources';
import { centsToInput, formatCents, formatIsoDate, parseCents, parseIsoDate, parseNumber, useSubmit } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import { useDialog } from './Dialog';
import { Icon } from './AppChrome';
import { Avatar, Badge, Button, Card, ChoiceField, EmptyState, Field, FormSheet, HeroCard, IconBubble, ListRow, Loading, Notice, PlanLimitNotice, Row, Screen, ScreenHeader, SearchField, Section, StatCard, TimelinePanel, TimelineRow, WeekStrip, quebraLonga, ui } from './ui';

export type ProfessionalScreenProps = { onBack?: () => void; onAction?: (action: string) => void };

const money = (cents: number) => formatCents(cents);
const initialsOf = (name: string) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();

/**
 * Aviso das telas ainda sem servidor.
 *
 * Clientes, agenda e financeiro estão nas fases 3 e 4 do roadmap e fora do
 * backlog do MVP: não existe API para eles. Em vez de esconder as telas, elas
 * mostram um exemplo e dizem, sem rodeio, que os dados não são seus.
 */
function DemoNotice({ what }: { what: string }) {
  return <Notice tone="lilac" message={`${what} ainda está em construção. Os dados abaixo são um exemplo — nada aqui é salvo na sua conta.`} />;
}

// --- estoque de materiais (ligado à API) ----------------------------------

const emptyMaterial = { name: '', category: '', price: '', quantity: '1', unit: UNITS[0].label, waste: '0', purchaseDate: '' };

export function InventoryScreen({ onBack, onAction }: ProfessionalScreenProps) {
  const app = useApp();
  const { busy, error, limitReached, setError, clear, run } = useSubmit();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState(emptyMaterial);
  const [query, setQuery] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [offerArchive, setOfferArchive] = useState(false);

  const limit = app.subscription?.limits.materials ?? null;
  const reachedLimit = limit !== null && app.materials.length >= limit;
  const matches = (item: Material) => item.name.toLowerCase().includes(query.toLowerCase());
  const active = app.materials.filter(item => !item.isArchived && matches(item));
  const archived = app.materials.filter(item => item.isArchived && matches(item));
  const total = app.materials.reduce((sum, item) => sum + item.purchasePriceCents, 0);

  const startNew = () => {
    setEditing(null);
    setForm(emptyMaterial);
    clear();
    setDone(null);
    setOfferArchive(false);
    setOpen(true);
  };

  const startEdit = (material: Material) => {
    setEditing(material);
    setForm({
      name: material.name,
      category: labelOf(MATERIAL_CATEGORIES, material.category),
      price: centsToInput(material.purchasePriceCents),
      quantity: String(material.purchaseQuantity),
      unit: labelOf(UNITS, material.unit),
      waste: String(material.wastePercent),
      purchaseDate: material.purchaseDate ? formatIsoDate(material.purchaseDate) : '',
    });
    clear();
    setDone(null);
    setOfferArchive(false);
    setOpen(true);
  };

  const submit = () => {
    const quantity = parseNumber(form.quantity);
    if (!form.name.trim()) {
      setError('Dê um nome ao material.');
      return;
    }
    if (quantity <= 0) {
      setError('A quantidade comprada precisa ser maior que zero.');
      return;
    }
    if (form.purchaseDate.trim() && !parseIsoDate(form.purchaseDate)) {
      setError('Escreva a data da compra no formato DD/MM/AAAA.');
      return;
    }

    const input = {
      name: form.name.trim(),
      // Categoria é organização de estoque: se ela não escolheu, o nome decide.
      category: form.category ? slugOf(MATERIAL_CATEGORIES, form.category) : guessMaterialCategory(form.name),
      purchasePriceCents: parseCents(form.price),
      purchaseQuantity: quantity,
      unit: slugOf(UNITS, form.unit),
      wastePercent: parseNumber(form.waste),
      purchaseDate: parseIsoDate(form.purchaseDate),
    };

    void run(async () => {
      if (editing) await app.updateMaterial(editing.id, input);
      else await app.createMaterial(input);
      setOpen(false);
      setDone(editing ? 'Material atualizado.' : 'Material cadastrado.');
    });
  };

  const archive = (material: Material, archived: boolean) => {
    void run(async () => {
      await app.archiveMaterial(material.id, archived);
      setOpen(false);
      setDone(archived
        ? `"${material.name}" foi arquivado e continua nos serviços que já o usam.`
        : `"${material.name}" voltou para o estoque.`);
    });
  };

  /**
   * Excluir só vale para material que nenhum serviço usa. Quando o servidor
   * recusa com 409, o caminho é arquivar — assim a composição já montada e o
   * histórico continuam de pé.
   */
  const remove = () => {
    const material = editing;
    if (!material) return;

    void (async () => {
      const removed = await run(async () => {
        await app.removeMaterial(material.id);
        setOpen(false);
        setDone('Material excluído.');
      });
      if (!removed) setOfferArchive(true);
    })();
  };

  const rowOf = (material: Material) => (
    <ListRow
      key={material.id}
      icon="box"
      iconTone={material.isArchived ? 'neutral' : 'lilac'}
      title={material.name}
      subtitle={`${labelOf(MATERIAL_CATEGORIES, material.category)} · ${material.purchaseQuantity} ${labelOf(UNITS, material.unit)}${material.purchaseDate ? ` · comprado em ${formatIsoDate(material.purchaseDate)}` : ''}`}
      meta={material.unitCostCents === null ? money(material.purchasePriceCents) : `${money(material.unitCostCents)} / ${labelOf(UNITS, material.unit)}`}
      badge={material.isArchived ? <Badge label="Arquivado" tone="warning" /> : undefined}
      onPress={() => startEdit(material)}
    />
  );

  return <Screen>
    <ScreenHeader title="Estoque" subtitle="Materiais e produtos do seu atendimento" onBack={onBack} />
    <SearchField value={query} onChangeText={setQuery} placeholder="Buscar material..." />
    <Row>
      <StatCard icon="box" label="Materiais" value={limit === null ? String(app.materials.length) : `${app.materials.length} de ${limit}`} caption={limit === null ? 'Ilimitados no seu plano' : 'Limite do plano gratuito'} />
      <StatCard icon="wallet" label="Investido" value={money(total)} caption="Soma das compras" tone="lilac" />
    </Row>
    {done && <Notice tone="success" message={done} />}
    {!open && error && (limitReached
      ? <PlanLimitNotice message={error} onUpgrade={() => onAction?.('plans')} />
      : <Notice message={error} />)}
    {reachedLimit && <PlanLimitNotice message="Você já usa todos os materiais do plano gratuito. Nada é apagado: ao assinar, o cadastro fica sem limite." onUpgrade={() => onAction?.('plans')} />}
    <Button label="Adicionar material" icon="plus" onPress={startNew} />

    <Section title="Meus materiais" first />
    {busy && !open && <Loading label="Atualizando o estoque..." />}
    {app.materials.length === 0
      ? <EmptyState icon="box" title="Nenhum material cadastrado" description="Cadastre o que você usa para o custo entrar no cálculo do preço." action="Adicionar material" onAction={startNew} />
      : active.map(rowOf)}
    {app.materials.length > 0 && active.length === 0 && archived.length === 0 && <EmptyState icon="search" title="Nada encontrado" description="Nenhum material com esse nome." />}

    {archived.length > 0 && <>
      <Section title="Arquivados" />
      <Text style={s.hint}>Ficam fora da lista de compras, mas seguem valendo nos serviços e nos cálculos antigos.</Text>
      {archived.map(rowOf)}
    </>}

    <FormSheet
      visible={open}
      title={editing ? 'Editar material' : 'Novo material'}
      subtitle="O custo por unidade sai do preço da compra dividido pela quantidade."
      busy={busy}
      error={error}
      limitReached={limitReached}
      onUpgrade={() => onAction?.('plans')}
      onClose={() => setOpen(false)}
      onSubmit={submit}
      onDelete={editing && !editing.isArchived ? remove : undefined}
      deleteQuestion={editing ? `Excluir "${editing.name}" do seu estoque?` : undefined}
    >
      {offerArchive && (
        <Notice
          tone="warning"
          message="Não dá para excluir: algum serviço usa este material. Arquivar tira ele da lista e mantém as composições e os cálculos antigos intactos."
          action="Arquivar"
          onAction={() => { setOfferArchive(false); if (editing) archive(editing, true); }}
        />
      )}
      <Field label="Nome do material" value={form.name} onChangeText={value => setForm({ ...form, name: value })} placeholder="Ex.: Gel construtor" />
      <ChoiceField
        label="Onde guardar no estoque"
        items={MATERIAL_CATEGORIES.map(item => item.label)}
        value={form.category || labelOf(MATERIAL_CATEGORIES, guessMaterialCategory(form.name))}
        onChange={value => setForm({ ...form, category: value })}
        hint="Só para achar o item depois; não entra no cálculo."
      />
      <Row>
        <View style={ui.grow}><Field label="Preço da compra" value={form.price} onChangeText={value => setForm({ ...form, price: value })} prefix="R$" numeric /></View>
        <View style={ui.grow}><Field label="Quantidade comprada" value={form.quantity} onChangeText={value => setForm({ ...form, quantity: value })} numeric /></View>
      </Row>
      <ChoiceField label="Unidade" items={UNITS.map(item => item.label)} value={form.unit} onChange={value => setForm({ ...form, unit: value })} />
      <Row>
        <View style={ui.grow}><Field label="Perda estimada (%)" value={form.waste} onChangeText={value => setForm({ ...form, waste: value })} numeric hint="sobra, evaporação" /></View>
        <View style={ui.grow}><Field label="Data da compra" value={form.purchaseDate} onChangeText={value => setForm({ ...form, purchaseDate: value })} placeholder="DD/MM/AAAA" hint="opcional" /></View>
      </Row>
      {editing && <Button
        label={editing.isArchived ? 'Voltar para o estoque' : 'Arquivar material'}
        icon={editing.isArchived ? 'check' : 'box'}
        secondary
        onPress={busy ? undefined : () => archive(editing, !editing.isArchived)}
      />}
    </FormSheet>
  </Screen>;
}

// --- perfil e conta (ligado à API) ----------------------------------------

export function ProfileScreen({ onBack, onAction }: ProfessionalScreenProps) {
  const app = useApp();
  const dialog = useDialog();
  const profile = useSubmit();
  const password = useSubmit();
  const [nameOpen, setNameOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [name, setName] = useState(app.user?.name ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  // A agenda está no ar quando existe link: é a mesma verdade que o servidor
  // usa para responder à cliente, e não uma preferência guardada à parte.
  const agendaAberta = Boolean(app.business?.bookingSlug);

  const plan = app.subscription?.plan ?? 'FREE';
  const planLabel = plan === 'FREE' ? 'Plano gratuito' : plan === 'PREMIUM' ? 'Premium' : 'Master';

  const saveName = () => {
    if (!name.trim()) {
      profile.setError('Diga como você quer ser chamada.');
      return;
    }
    void profile.run(async () => {
      await app.updateProfile({ name: name.trim() });
      setNameOpen(false);
    });
  };

  const savePassword = () => {
    void password.run(async () => {
      await app.changePassword({ currentPassword: current, newPassword: next });
      // A troca derruba as sessões: o provedor já devolve a usuária à entrada.
      setPasswordOpen(false);
    });
  };

  const confirmDelete = () => {
    dialog.confirm({
      title: 'Excluir minha conta',
      message: 'Isso apaga de vez seus serviços, materiais, custos, agenda e histórico. Não dá para desfazer.',
      confirmLabel: 'Excluir tudo',
      destructive: true,
      onConfirm: () => void app.deleteAccount(),
    });
  };

  const confirmSignOut = () => {
    dialog.confirm({
      title: 'Sair da conta',
      message: 'Você precisará entrar de novo neste aparelho.',
      confirmLabel: 'Sair',
      onConfirm: () => void app.signOut(),
    });
  };

  return <Screen>
    <ScreenHeader title="Meu perfil" subtitle="Configurações da sua conta" onBack={onBack} />
    <Card>
      <View style={s.profile}>
        <Avatar initials={initialsOf(app.user?.name ?? 'BC')} size={64} />
        <Text style={s.profileName}>{app.user?.name ?? 'Sua conta'}</Text>
        <Text style={[ui.rowSub, quebraLonga]}>{app.business?.name ?? app.user?.email ?? ''}</Text>
        <View style={s.profileBadge}><Badge label={planLabel} tone="lilac" /></View>
      </View>
    </Card>
    <Button label="Editar perfil" icon="edit" secondary onPress={() => { setName(app.user?.name ?? ''); profile.setError(null); setNameOpen(true); }} />

    {/*
      Separado do resto de propósito: aqui está o que as suas clientes veem e
      usam. O que é da conta — senha, plano, nome — fica na seção seguinte,
      porque são coisas que se mexe uma vez e esquece.
    */}
    <Section title="Modo empresa" first />
    <ListRow
      icon="calendar"
      iconTone={agendaAberta ? 'pink' : 'lilac'}
      title="Link para receber agendamentos"
      subtitle={agendaAberta
        ? 'Ligado: suas clientes marcam sozinhas pelo link'
        : 'Desligado: ninguém consegue marcar por enquanto'}
      badge={<Badge label={agendaAberta ? 'No ar' : 'Fechada'} tone={agendaAberta ? 'success' : 'lilac'} />}
      onPress={() => onAction?.('booking')}
    />
    <ListRow
      icon="clock"
      title="Meu expediente"
      subtitle="Os dias e horas em que você atende — é o que decide os horários oferecidos"
      onPress={() => onAction?.('hours')}
    />
    <ListRow
      icon="tag"
      title="Meus serviços e preços"
      subtitle="Só serviço com preço aparece para a cliente escolher"
      onPress={() => onAction?.('services')}
    />

    <Section title="Conta e negócio" />
    <ListRow icon="store" title="Dados do negócio" subtitle={app.business?.name ?? 'Sem nome definido'} onPress={() => setNameOpen(true)} />
    <ListRow icon="sparkle" title="Meu plano" subtitle={planLabel} onPress={() => onAction?.('plans')} />
    <ListRow icon="lock" title="Trocar senha" subtitle="Encerra as sessões abertas" onPress={() => { setCurrent(''); setNext(''); password.setError(null); setPasswordOpen(true); }} />
    <ListRow icon="bell" title="Notificações" subtitle="Lembretes e avisos — em breve" onPress={() => dialog.inform({ title: 'Em breve', message: 'Os lembretes e avisos ainda estão sendo preparados.' })} />

    <Section title="Seus dados" />
    <ListRow icon="help" title="Central de ajuda" subtitle="Tire suas dúvidas" onPress={() => dialog.inform({ title: 'Central de ajuda', message: 'Escreva para suporte@beautyconta.com.br e respondemos por e-mail.' })} />
    <ListRow icon="logout" title="Sair da conta" subtitle="Encerra a sessão neste aparelho" onPress={confirmSignOut} />
    <ListRow icon="alert" iconTone="danger" title="Excluir minha conta" subtitle="Apaga tudo, sem volta" onPress={confirmDelete} />
    <Text style={[s.version, quebraLonga]}>BeautyConta · versão 1.0.0 · {app.user?.email ?? ''}</Text>

    <FormSheet visible={nameOpen} title="Editar perfil" busy={profile.busy} error={profile.error} onClose={() => setNameOpen(false)} onSubmit={saveName}>
      <Field label="Seu nome" value={name} onChangeText={setName} placeholder="Como você quer ser chamada" />
      <Text style={[s.hint, quebraLonga]}>O e-mail da conta é {app.user?.email ?? '—'} e não muda por aqui.</Text>
    </FormSheet>

    <FormSheet visible={passwordOpen} title="Trocar senha" subtitle="Ao trocar, você sai de todos os aparelhos." busy={password.busy} error={password.error} onClose={() => setPasswordOpen(false)} onSubmit={savePassword}>
      <Field label="Senha atual" value={current} onChangeText={setCurrent} secure />
      <Field label="Nova senha" value={next} onChangeText={setNext} secure hint="Mínimo de 8 caracteres" />
    </FormSheet>
  </Screen>;
}

// --- telas de demonstração (ainda sem servidor) ---------------------------

const demoClients = [
  { name: 'Mariana Souza', last: 'Alongamento em gel · hoje' },
  { name: 'Ana Beatriz', last: 'Manutenção · 05/09' },
  { name: 'Júlia Almeida', last: 'Esmaltação · 02/09' },
  { name: 'Camila Rocha', last: 'Alongamento · 28/08' },
];

export function ClientsScreen({ onBack }: ProfessionalScreenProps) {
  const [query, setQuery] = useState('');
  const filtered = demoClients.filter(client => client.name.toLowerCase().includes(query.toLowerCase()));

  return <Screen>
    <ScreenHeader title="Clientes" subtitle="Quem passa pelas suas mãos" onBack={onBack} />
    <DemoNotice what="A agenda de clientes" />
    <SearchField value={query} onChangeText={setQuery} placeholder="Buscar cliente..." />
    <Section title="Exemplo de lista" first />
    {filtered.map((client, index) => (
      <ListRow key={client.name} initials={initialsOf(client.name)} iconTone={index % 2 === 0 ? 'pink' : 'lilac'} title={client.name} subtitle={client.last} />
    ))}
    {filtered.length === 0 && <EmptyState icon="users" title="Nenhuma cliente encontrada" description="Ajuste a busca para ver os exemplos." />}
  </Screen>;
}

const demoAppointments = [
  { time: '09:00', end: '11:00', name: 'Mariana Souza', service: 'Alongamento em gel', confirmed: true },
  { time: '11:30', end: '12:30', name: 'Ana Beatriz', service: 'Manutenção de unhas', confirmed: false },
  { time: '14:00', end: '15:00', name: 'Júlia Almeida', service: 'Esmaltação em gel', confirmed: true },
];

export function AgendaScreen({ onBack }: ProfessionalScreenProps) {
  const [today] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => today.getDay());
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + index);
    return date;
  }), [today]);

  const selectedDate = week[selectedDay];
  const day = selectedDay === 0 ? [] : selectedDay % 2 === 0 ? demoAppointments.slice(1) : demoAppointments;
  const dateLabel = selectedDay === today.getDay() ? 'Hoje' : selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' });

  return <Screen>
    <ScreenHeader title="Agenda" subtitle="Organize seu dia" onBack={onBack} />
    <DemoNotice what="A agenda" />
    <View style={s.meta}>
      <Text style={s.month}>{selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
      <Text style={s.metaHint}>{day.length} {day.length === 1 ? 'atendimento' : 'atendimentos'}</Text>
    </View>
    <WeekStrip dates={week} selected={selectedDay} onSelect={setSelectedDay} marked={index => index !== 0} />
    <TimelinePanel title={`${dateLabel}, ${selectedDate.getDate()}`}>
      {day.length === 0
        ? <EmptyState icon="calendar" title="Seu dia está livre" description="Um respiro na agenda ou espaço para uma nova cliente." />
        : day.map((item, index) => (
          <TimelineRow
            key={item.time}
            time={item.time}
            endTime={item.end}
            initials={initialsOf(item.name)}
            title={item.name}
            subtitle={item.service}
            status={item.confirmed ? 'Confirmado' : 'A confirmar'}
            pending={!item.confirmed}
            last={index === day.length - 1}
          />
        ))}
    </TimelinePanel>
  </Screen>;
}

export function FinanceScreen({ onBack, onAction }: ProfessionalScreenProps) {
  const app = useApp();
  // O ticket médio é o da tabela em vigor: o serviço arquivado não a compõe mais.
  const services = app.services.filter(service => !service.isArchived && service.currentPriceCents !== null);
  const average = services.length
    ? services.reduce((sum, item) => sum + (item.currentPriceCents ?? 0), 0) / services.length
    : 0;
  const fixed = app.fixedCosts.reduce((sum, item) => sum + (item.isActive ? item.monthlyAmountCents : 0), 0);
  const lastCalculation = app.calculations[0] ?? null;

  return <Screen>
    <ScreenHeader title="Financeiro" subtitle="O que os seus números já dizem" onBack={onBack} />
    <HeroCard
      label="Ticket médio da sua tabela"
      value={money(average)}
      caption={`${services.length} ${services.length === 1 ? 'serviço com preço' : 'serviços com preço'}`}
      hint="Calculado a partir dos seus cadastros"
      onPress={() => onAction?.('services')}
      accessibilityLabel="Ver meus serviços"
    />
    <Row>
      <StatCard icon="wallet" label="Custos fixos" value={money(fixed)} caption="Por mês" onPress={() => onAction?.('costs')} />
      <StatCard
        icon="trend"
        label="Último lucro calculado"
        value={lastCalculation ? money(lastCalculation.expectedProfitCents) : '—'}
        caption={lastCalculation ? `Margem de ${lastCalculation.expectedMarginPercent}%` : 'Faça um cálculo'}
        tone="lilac"
        onPress={() => onAction?.('pricing')}
      />
    </Row>
    <Notice tone="lilac" message="O controle de recebimentos entra numa fase seguinte. Por enquanto, o que aparece aqui vem dos seus cadastros e cálculos." />
    <Section title="Seus últimos cálculos" first />
    {app.calculations.length === 0
      ? <EmptyState icon="chart" title="Nenhum cálculo salvo" description="Calcule o preço de um serviço e salve para acompanhar aqui." action="Ir para a calculadora" onAction={() => onAction?.('pricing')} />
      : app.calculations.slice(0, 6).map(item => (
        <ListRow
          key={item.id}
          icon="check"
          iconTone="success"
          title={app.services.find(service => service.id === item.serviceId)?.name ?? 'Cálculo avulso'}
          subtitle={new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
          meta={money(item.commercialPriceCents)}
        />
      ))}
  </Screen>;
}

export function ReportsScreen({ onBack, onAction }: ProfessionalScreenProps) {
  const app = useApp();
  const calculations = app.calculations.slice(0, 6).reverse();
  const highest = Math.max(...calculations.map(item => item.commercialPriceCents), 1);
  const averageMargin = calculations.length
    ? calculations.reduce((sum, item) => sum + item.expectedMarginPercent, 0) / calculations.length
    : 0;
  const bestService = app.services.reduce<{ name: string; profit: number } | null>((best, service) => {
    const calculation = app.calculations.find(item => item.serviceId === service.id);
    if (!calculation) return best;
    return !best || calculation.expectedProfitCents > best.profit
      ? { name: service.name, profit: calculation.expectedProfitCents }
      : best;
  }, null);

  return <Screen>
    <ScreenHeader title="Relatórios" subtitle="Decisões baseadas nos seus números" onBack={onBack} />
    {calculations.length === 0
      ? <EmptyState icon="chart" title="Ainda sem dados" description="Os relatórios se formam a partir dos cálculos que você salva." action="Calcular um preço" onAction={() => onAction?.('pricing')} />
      : <>
        <Section title="Preços calculados" first />
        <Card>
          <View style={s.bars}>{calculations.map(item => (
            <View key={item.id} style={s.barWrap}>
              <View style={[s.bar, { height: Math.max(18, (item.commercialPriceCents / highest) * 120), backgroundColor: colors.lilac }]} />
              <Text style={s.barLabel}>{new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</Text>
            </View>
          ))}</View>
        </Card>
        <Section title="Indicadores" />
        <Row>
          <StatCard icon="calendar" label="Cálculos salvos" value={String(app.calculations.length)} caption="No seu histórico" />
          <StatCard icon="trend" label="Margem média" value={`${averageMargin.toFixed(1)}%`} caption="Dos últimos cálculos" tone="lilac" />
        </Row>
        <Row>
          <StatCard icon="tag" label="Serviços" value={String(app.services.length)} caption="Na sua tabela" tone="lilac" />
          <StatCard icon="sparkle" label="Mais lucrativo" value={bestService?.name ?? '—'} caption={bestService ? money(bestService.profit) : 'Sem cálculo'} />
        </Row>
      </>}
    <Section title="Insight BeautyConta" />
    <Card tone="lilac">
      <View style={s.insightRow}>
        <IconBubble name="sparkle" tone="lilac" size={38} />
        <View style={ui.grow}>
          <Text style={ui.rowTitle}>{bestService ? 'Aposte no que já dá lucro' : 'Comece pelo primeiro cálculo'}</Text>
          <Text style={s.insight}>{bestService
            ? `${bestService.name} é o seu serviço com maior lucro por atendimento. Um pacote de manutenção aumenta o retorno das clientes.`
            : 'Cadastre seus materiais e custos fixos: com eles, o preço sugerido reflete a sua realidade, não uma média de mercado.'}</Text>
        </View>
      </View>
    </Card>
  </Screen>;
}

const s = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 13 },
  month: { color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  metaHint: { color: colors.muted, fontSize: 10 },
  groupLabel: { fontSize: 12, fontWeight: '500', color: colors.muted, marginBottom: 9 },
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17 },
  bars: { height: 140, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  barWrap: { alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  bar: { width: 26, borderRadius: 8 },
  barLabel: { color: colors.faded, fontSize: 9 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  insight: { color: colors.ink3, fontSize: 11, lineHeight: 18, marginTop: 5 },
  profile: { alignItems: 'center', gap: 7, paddingVertical: 6 },
  profileName: { color: colors.ink, fontSize: 17, fontWeight: '600', letterSpacing: -0.3, marginTop: 3 },
  profileBadge: { marginTop: 4 },
  version: { color: colors.faded, fontSize: 10, textAlign: 'center', marginTop: 18 },
});
