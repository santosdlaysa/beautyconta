import { colors } from '../theme';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MATERIAL_CATEGORIES, SERVICE_CATEGORIES, UNITS, guessMaterialCategory, labelOf, slugOf } from '../lib/catalog';
import type { Service, ServiceMaterial } from '../lib/resources';
import { centsToInput, formatCents, formatMoney, parseCents, parseNumber, useSubmit } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import { Icon } from './AppChrome';
import { Button, ChoiceField, Chips, Field, FormSheet, Notice, Row, ui } from './ui';
import { UsageField, usageSummary } from './UsageField';

/**
 * Cadastro do serviço, com a composição de materiais.
 *
 * A composição é o que separa um palpite de um preço: sem saber quanto de gel,
 * de fibra e de lixa entra em cada atendimento, o custo do material vira
 * chute. Por isso ela mora aqui, no mesmo lugar em que o serviço nasce, e não
 * numa tela separada que a usuária talvez nunca visite.
 */

type Draft = {
  name: string;
  category: string;
  duration: string;
  margin: string;
  fee: string;
  otherCosts: string;
  materials: ServiceMaterial[];
};

const emptyDraft = (): Draft => ({
  name: '',
  category: SERVICE_CATEGORIES[0].label,
  duration: '90',
  margin: '30',
  fee: '0',
  otherCosts: '',
  materials: [],
});

type NewMaterial = { name: string; price: string; quantity: string; unit: string; waste: string; used: number };

const emptyMaterial: NewMaterial = {
  name: '',
  price: '',
  quantity: '',
  unit: UNITS[0].label,
  waste: '0',
  used: 0,
};

/** Custo de uma unidade da embalagem, já com a perda embutida. */
function unitCostOf(novo: NewMaterial): number {
  const price = parseNumber(novo.price);
  const quantity = parseNumber(novo.quantity);
  if (price <= 0 || quantity <= 0) return 0;
  return Math.round(((price / quantity) * (1 + parseNumber(novo.waste) / 100)) * 100);
}

const draftOf = (service: Service): Draft => ({
  name: service.name,
  category: labelOf(SERVICE_CATEGORIES, service.category),
  duration: String(service.durationMinutes),
  margin: String(service.desiredMarginPercent),
  fee: String(service.salesFeePercent),
  otherCosts: service.otherDirectCostCents ? centsToInput(service.otherDirectCostCents) : '',
  materials: service.materials.map((item) => ({ ...item })),
});

export function ServiceSheet({ visible, service, onClose, onSaved, onArchived, onUpgrade }: {
  visible: boolean;
  /** `null` abre em branco: é o mesmo formulário para criar e para editar. */
  service: Service | null;
  onClose: () => void;
  onSaved?: (service: Service) => void;
  /** Arquivado ou restaurado: a lista avisa o que aconteceu. */
  onArchived?: (service: Service, archived: boolean) => void;
  /** Caminho para a assinatura quando o plano gratuito recusa mais um serviço. */
  onUpgrade?: () => void;
}) {
  const app = useApp();
  const { busy, error, limitReached, setError, run } = useSubmit();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [offerArchive, setOfferArchive] = useState(false);
  const [novo, setNovo] = useState(emptyMaterial);

  // Reabrir o formulário sempre parte do serviço atual, nunca do rascunho velho.
  useEffect(() => {
    if (visible) {
      setDraft(service ? draftOf(service) : emptyDraft());
      setPicking(false);
      setCreating(false);
      setOfferArchive(false);
      setNovo(emptyMaterial);
      setError(null);
    }
  }, [visible, service, setError]);

  const materialById = useMemo(
    () => new Map(app.materials.map((material) => [material.id, material])),
    [app.materials],
  );

  /** Custo dos materiais do jeito que o servidor calcula: unidade × quantidade. */
  const materialCostCents = draft.materials.reduce((sum, item) => {
    const material = materialById.get(item.materialId);
    return sum + Math.round((material?.unitCostCents ?? 0) * item.quantityUsed);
  }, 0);

  const available = app.materials.filter(
    (material) => !material.isArchived && !draft.materials.some((item) => item.materialId === material.id),
  );

  const addMaterial = (id: string) => {
    setDraft((current) => ({ ...current, materials: [...current.materials, { materialId: id, quantityUsed: 1 }] }));
    setPicking(false);
    // Abre direto no consumo: é a pergunta que falta responder.
    setExpanded(id);
  };

  const setQuantity = (id: string, quantityUsed: number) => {
    setDraft((current) => ({
      ...current,
      materials: current.materials.map((item) => (item.materialId === id ? { ...item, quantityUsed } : item)),
    }));
  };

  const removeMaterial = (id: string) => {
    setDraft((current) => ({ ...current, materials: current.materials.filter((item) => item.materialId !== id) }));
  };

  /**
   * Cadastro de material sem sair do serviço.
   *
   * Quem está montando o preço de um alongamento não quer ser mandada para
   * outra tela para dizer quanto custou o gel: cadastra aqui, com a quantidade
   * que usa por atendimento, e o material entra no estoque e na composição na
   * mesma ação.
   */
  const createAndAdd = () => {
    const quantity = parseNumber(novo.quantity);
    const used = novo.used;

    if (!novo.name.trim()) {
      setError('Dê um nome ao material.');
      return;
    }
    if (quantity <= 0) {
      setError('Diga quanto vem na embalagem que você compra.');
      return;
    }

    void run(async () => {
      const material = await app.createMaterial({
        name: novo.name.trim(),
        // Sem perguntar: a categoria é organização de estoque, não dado de cálculo.
        category: guessMaterialCategory(novo.name),
        purchasePriceCents: parseCents(novo.price),
        purchaseQuantity: quantity,
        unit: slugOf(UNITS, novo.unit),
        wastePercent: parseNumber(novo.waste),
      });

      setDraft((current) => ({
        ...current,
        materials: [...current.materials, { materialId: material.id, quantityUsed: used > 0 ? used : 1 }],
      }));
      setNovo(emptyMaterial);
      setCreating(false);
    });
  };

  const submit = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Dê um nome ao serviço.');
      return;
    }

    const duration = Math.round(parseNumber(draft.duration));
    if (duration < 1) {
      setError('A duração precisa ser de pelo menos 1 minuto.');
      return;
    }

    const input = {
      name,
      category: slugOf(SERVICE_CATEGORIES, draft.category),
      durationMinutes: duration,
      desiredMarginPercent: parseNumber(draft.margin),
      salesFeePercent: parseNumber(draft.fee),
      otherDirectCostCents: draft.otherCosts.trim() ? parseCents(draft.otherCosts) : 0,
      // Quantidade zerada é material que a usuária esqueceu de preencher: some
      // da composição em vez de entrar no cálculo como custo nenhum.
      materials: draft.materials.filter((item) => item.quantityUsed > 0),
    };

    void run(async () => {
      const saved = service ? await app.updateService(service.id, input) : await app.createService(input);
      onSaved?.(saved);
      onClose();
    });
  };

  const archive = (archived: boolean) => {
    if (!service) return;
    void run(async () => {
      const updated = await app.archiveService(service.id, archived);
      onArchived?.(updated, archived);
      onClose();
    });
  };

  /**
   * Excluir apaga o serviço; arquivar o tira da tabela e preserva o histórico.
   *
   * O mesmo caminho dos materiais: quando o servidor recusa a exclusão com 409,
   * a recusa vira convite para arquivar em vez de virar um erro sem saída.
   */
  const remove = () => {
    const current = service;
    if (!current) return;

    // A folha já perguntou. Se o servidor recusar (409, serviço em uso), a
    // recusa vira convite para arquivar, sem virar erro sem saída.
    void (async () => {
      const removed = await run(async () => {
        await app.removeService(current.id);
        onClose();
      });
      if (!removed) setOfferArchive(true);
    })();
  };

  return (
    <FormSheet
      visible={visible}
      title={service ? 'Editar serviço' : 'Novo serviço'}
      subtitle={service?.isArchived
        ? 'Serviço arquivado: fora da tabela, mas com os cálculos antigos de pé.'
        : service ? 'As mudanças não alteram cálculos já salvos.' : 'Estes dados entram direto no cálculo do preço.'}
      submitLabel={service ? 'Salvar alterações' : 'Salvar serviço'}
      busy={busy}
      error={error}
      limitReached={limitReached}
      onUpgrade={onUpgrade}
      onClose={onClose}
      onSubmit={submit}
      onDelete={service && !service.isArchived ? remove : undefined}
      deleteQuestion={service ? `Excluir "${service.name}" da sua tabela? Os cálculos já salvos continuam no histórico.` : undefined}
      actionsHidden={creating || picking}
    >
      <Field label="Nome do serviço" value={draft.name} onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Ex.: Alongamento em gel" />
      <ChoiceField label="Categoria" items={SERVICE_CATEGORIES.map((item) => item.label)} value={draft.category} onChange={(value) => setDraft({ ...draft, category: value })} />
      <Row>
        <View style={ui.grow}><Field label="Duração (minutos)" value={draft.duration} onChangeText={(value) => setDraft({ ...draft, duration: value })} numeric /></View>
        <View style={ui.grow}><Field label="Margem desejada (%)" value={draft.margin} onChangeText={(value) => setDraft({ ...draft, margin: value })} numeric /></View>
      </Row>
      <Row>
        <View style={ui.grow}><Field label="Taxa de venda (%)" value={draft.fee} onChangeText={(value) => setDraft({ ...draft, fee: value })} numeric hint="cartão, Pix" /></View>
        <View style={ui.grow}><Field label="Outros custos" value={draft.otherCosts} onChangeText={(value) => setDraft({ ...draft, otherCosts: value })} prefix="R$" numeric /></View>
      </Row>

      {offerArchive && (
        <Notice
          tone="warning"
          message="Não dá para excluir: este serviço já explica cálculos salvos. Arquivar tira ele da tabela e mantém o histórico intacto."
          action="Arquivar"
          onAction={() => { setOfferArchive(false); archive(true); }}
        />
      )}

      <View style={s.composition}>
        <View style={s.compositionHead}>
          <View style={ui.grow}>
            <Text style={s.groupLabel}>Materiais usados neste atendimento</Text>
            <Text style={s.hint}>Quanto de cada item sai do estoque a cada cliente.</Text>
          </View>
          <Text style={s.compositionTotal}>{formatCents(materialCostCents)}</Text>
        </View>

        {app.materials.length === 0 && (
          <Notice tone="lilac" message="Você ainda não cadastrou materiais. Cadastre no Estoque para o custo entrar no preço automaticamente." />
        )}

        {draft.materials.map((item) => {
          const material = materialById.get(item.materialId);
          const unit = material ? labelOf(UNITS, material.unit) : '';
          const cost = Math.round((material?.unitCostCents ?? 0) * item.quantityUsed);

          const opened = expanded === item.materialId;

          return (
            <View key={item.materialId} style={s.materialRow}>
              <View style={s.materialHead}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: opened }}
                  accessibilityLabel={`Ajustar consumo de ${material?.name ?? 'material'}`}
                  onPress={() => setExpanded(opened ? null : item.materialId)}
                  style={({ pressed }) => [ui.grow, pressed && ui.pressed]}
                >
                  <Text style={ui.rowTitle}>{material?.name ?? 'Material removido'}</Text>
                  <Text style={ui.rowSub}>
                    {material?.unitCostCents
                      ? usageSummary(unit, item.quantityUsed, material.unitCostCents)
                      : `${formatCents(cost)} neste serviço`}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${material?.name ?? 'material'} da composição`}
                  onPress={() => removeMaterial(item.materialId)}
                  style={({ pressed }) => [s.removeMaterial, pressed && ui.pressed]}
                >
                  <View style={s.removeIcon}><Icon name="plus" size={16} color={colors.danger} /></View>
                </Pressable>
              </View>

              {opened && material && (
                <UsageField
                  unitLabel={unit}
                  packageQuantity={material.purchaseQuantity}
                  unitCostCents={material.unitCostCents ?? 0}
                  value={item.quantityUsed}
                  onChange={(quantityUsed) => setQuantity(item.materialId, quantityUsed)}
                  appointmentsPerMonth={app.settings?.estimatedAppointmentsPerMonth}
                />
              )}
            </View>
          );
        })}

        {picking && (
          <View style={s.picker}>
            <Text style={s.hint}>Toque no material para incluir na composição.</Text>
            <Chips items={available.map((material) => material.name)} value="" onChange={(name) => {
              const chosen = available.find((material) => material.name === name);
              if (chosen) addMaterial(chosen.id);
            }} />
            <Pressable accessibilityRole="button" onPress={() => setPicking(false)} style={({ pressed }) => [s.textAction, pressed && ui.pressed]}>
              <Text style={ui.link}>Cancelar</Text>
            </Pressable>
          </View>
        )}

        {creating && (
          <View style={s.picker}>
            <Text style={s.newTitle}>Novo material</Text>
            <Text style={s.hint}>Informe o preço da embalagem inteira e quanto vem nela. O custo por atendimento sai daí.</Text>
            <Field
              label="Nome"
              value={novo.name}
              onChangeText={(value) => setNovo({ ...novo, name: value })}
              placeholder="Ex.: Gel construtor"
              hint={novo.name.trim() ? labelOf(MATERIAL_CATEGORIES, guessMaterialCategory(novo.name)) : undefined}
            />
            <Row>
              <View style={ui.grow}><Field label="Preço da compra" value={novo.price} onChangeText={(value) => setNovo({ ...novo, price: value })} prefix="R$" numeric /></View>
              <View style={ui.grow}><Field label="Quanto vem" value={novo.quantity} onChangeText={(value) => setNovo({ ...novo, quantity: value })} numeric hint={novo.unit} /></View>
            </Row>
            <ChoiceField label="Unidade" items={UNITS.map((item) => item.label)} value={novo.unit} onChange={(value) => setNovo({ ...novo, unit: value })} />
            <Field label="Perda estimada (%)" value={novo.waste} onChangeText={(value) => setNovo({ ...novo, waste: value })} numeric hint="sobra, evaporação" />
            <UsageField
              unitLabel={novo.unit}
              packageQuantity={parseNumber(novo.quantity)}
              unitCostCents={unitCostOf(novo)}
              value={novo.used}
              onChange={(quantityUsed) => setNovo({ ...novo, used: quantityUsed })}
              appointmentsPerMonth={app.settings?.estimatedAppointmentsPerMonth}
            />
            <Button label={busy ? 'Salvando...' : 'Cadastrar e incluir'} icon="check" onPress={busy ? undefined : createAndAdd} />
            <Pressable accessibilityRole="button" onPress={() => { setCreating(false); setError(null); }} style={({ pressed }) => [s.textAction, pressed && ui.pressed]}>
              <Text style={ui.link}>Cancelar</Text>
            </Pressable>
          </View>
        )}

        {!picking && !creating && (
          <View style={s.compositionActions}>
            {available.length > 0 && (
              <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={({ pressed }) => [s.addMaterial, pressed && ui.pressed]}>
                <Icon name="box" size={16} color={colors.accent} />
                <Text style={ui.link}>Do meu estoque</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={() => { setCreating(true); setPicking(false); setError(null); }} style={({ pressed }) => [s.addMaterial, s.addPrimary, pressed && ui.pressed]}>
              <Icon name="plus" size={16} color={colors.accent} />
              <Text style={ui.link}>Cadastrar material novo</Text>
            </Pressable>
          </View>
        )}
      </View>

      {service && <Button
        label={service.isArchived ? 'Voltar para a minha tabela' : 'Arquivar serviço'}
        icon={service.isArchived ? 'check' : 'box'}
        secondary
        onPress={busy ? undefined : () => archive(!service.isArchived)}
      />}
    </FormSheet>
  );
}

const s = StyleSheet.create({
  groupLabel: { fontSize: 12, fontWeight: '500', color: colors.muted },
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17, marginTop: 3 },
  composition: { gap: 11, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15 },
  compositionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  compositionTotal: { color: colors.ink, fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },
  materialRow: { gap: 12, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12 },
  materialHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeMaterial: { padding: 4 },
  removeIcon: { width: 28, height: 28, borderRadius: 15, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] },
  compositionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addPrimary: { borderStyle: 'solid', borderColor: colors.lilac, backgroundColor: colors.softLilac },
  newTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  picker: { gap: 9, backgroundColor: colors.softLilac, borderRadius: 18, padding: 13 },
  addMaterial: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  textAction: { minHeight: 36, justifyContent: 'center' },
});
