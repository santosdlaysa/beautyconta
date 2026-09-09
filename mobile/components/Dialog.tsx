import { colors } from '../theme';
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ui } from './ui';

/**
 * Perguntas e avisos do aplicativo.
 *
 * Existe porque `Alert.alert` do React Native **não faz nada na web** — a
 * implementação do react-native-web é um método vazio. Todo confirmar e todo
 * aviso que passavam por ele sumiam em silêncio no navegador: excluir, sair da
 * conta, arquivar. Aqui a mesma pergunta é uma tela de verdade, igual nas duas
 * plataformas.
 */

type Request = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação sem volta: o botão fica vermelho e o rótulo diz o que acontece. */
  destructive?: boolean;
  onConfirm?: () => void;
};

type DialogApi = {
  /** Pergunta com duas saídas. Só chama `onConfirm` se a pessoa confirmar. */
  confirm(request: Request): void;
  /** Aviso de uma saída só. */
  inform(request: Omit<Request, 'onConfirm' | 'destructive'>): void;
};

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<(Request & { kind: 'confirm' | 'inform' }) | null>(null);

  const api = useMemo<DialogApi>(() => ({
    confirm: (input) => setRequest({ ...input, kind: 'confirm' }),
    inform: (input) => setRequest({ ...input, kind: 'inform' }),
  }), []);

  const close = useCallback(() => setRequest(null), []);

  const confirm = useCallback(() => {
    // Fecha antes de agir: se a ação abrir outra tela, a pergunta não fica
    // pendurada por cima dela.
    const action = request?.onConfirm;
    setRequest(null);
    action?.();
  }, [request]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal visible={request !== null} animationType="fade" transparent onRequestClose={close}>
        <View style={s.backdrop}>
          <View style={s.card}>
            <Text accessibilityRole="header" style={s.title}>{request?.title}</Text>
            {request?.message && <Text style={s.message}>{request.message}</Text>}

            <View style={s.actions}>
              {request?.kind === 'confirm' && (
                <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [s.cancel, pressed && ui.pressed]}>
                  <Text style={s.cancelText}>{request.cancelLabel ?? 'Cancelar'}</Text>
                </Pressable>
              )}
              <View style={ui.grow}>
                {request?.kind === 'confirm' && request.destructive ? (
                  <Pressable accessibilityRole="button" onPress={confirm} style={({ pressed }) => [s.destructive, pressed && ui.pressed]}>
                    <Text style={s.destructiveText}>{request.confirmLabel ?? 'Confirmar'}</Text>
                  </Pressable>
                ) : (
                  <Button
                    label={request?.kind === 'confirm' ? request.confirmLabel ?? 'Confirmar' : request?.confirmLabel ?? 'Entendi'}
                    onPress={request?.kind === 'confirm' ? confirm : close}
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog precisa estar dentro de DialogProvider.');
  return value;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26, backgroundColor: colors.veil },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.background, borderRadius: 26, padding: 22, gap: 11 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  message: { color: colors.ink3, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  cancel: { minHeight: 48, paddingHorizontal: 18, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softLilac },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  destructive: { minHeight: 48, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, paddingHorizontal: 16 },
  destructiveText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});
