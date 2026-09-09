import { colors } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { track } from '../lib/analytics';
import { rememberCalculation } from '../lib/anonymous';
import type { PublicPricingInput } from '../lib/resources';
import { useSubmit } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import { useDialog } from './Dialog';
import { Icon } from './AppChrome';
import { PublicCalculator } from './PublicCalculator';
import { Button, Card, Field, Notice, Screen, ScreenHeader, ui } from './ui';

/**
 * Fluxo de entrada: boas-vindas, calculadora pública, login, cadastro e
 * recuperação. O onboarding de cinco etapas vive em `OnboardingScreens.tsx`.
 */
export type AuthScreen = 'welcome' | 'calculator' | 'login' | 'signup' | 'forgot';

const socials = [
  { label: 'Google', color: '#4285f4' },
  { label: 'Facebook', color: '#1877f2' },
  { label: 'Apple', color: colors.ink },
];

/** A mesma assinatura da Home, para a marca ser a primeira coisa reconhecível. */
export function Brand({ center }: { center?: boolean }) {
  return <View style={[s.brandRow, center && s.center]}><Icon name="sparkle" size={20} color={colors.accent} /><Text style={s.brand}>beauty<Text style={s.brandAccent}>conta</Text></Text></View>;
}

function SocialRow() {
  const dialog = useDialog();
  return <View style={s.socialRow}>{socials.map(social => (
    <Pressable
      key={social.label}
      accessibilityRole="button"
      accessibilityLabel={`Continuar com ${social.label}`}
      // Entrar por provedor externo depende do ADR-0003; até lá o botão avisa.
      onPress={() => dialog.inform({ title: 'Em breve', message: `A entrada com ${social.label} ainda está sendo preparada. Use seu e-mail e senha.` })}
      style={({ pressed }) => [s.socialButton, pressed && ui.pressed]}
    >
      <View style={[s.socialDot, { backgroundColor: social.color }]} />
      <Text style={s.socialLabel}>{social.label}</Text>
    </Pressable>
  ))}</View>;
}

export function AuthView({ mode, onMode }: { mode: AuthScreen; onMode: (m: AuthScreen) => void }) {
  const app = useApp();
  const dialog = useDialog();
  const { busy, error, run } = useSubmit();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  /** Veio da calculadora pública: o cálculo espera no aparelho pela conta. */
  const [carrying, setCarrying] = useState(false);

  // Início do cadastro é o momento em que a tela aparece, não o do botão: é
  // entre chegar aqui e concluir que o funil do documento 05 mede a perda.
  useEffect(() => {
    if (mode === 'signup') track('signup_started');
  }, [mode]);

  if (mode === 'welcome') return (
    <LinearGradient colors={[colors.lilac, colors.pinkGradient]} style={s.welcomePage}>
      <View style={s.welcomeTop}><Brand center /></View>
      <View style={s.welcomeArt}>
        <View style={[s.orbit, s.orbitOne]} /><View style={[s.orbit, s.orbitTwo]} />
        <Icon name="sparkle" size={72} color={colors.white} />
        <Text style={s.welcomeArtText}>beauty{'\n'}business</Text>
      </View>
      <View style={s.welcomeSheet}>
        <Text style={s.welcomeTitle}>Bem-vinda à{`\n`}BeautyConta</Text>
        <Text style={s.welcomeSubtitle}>Organize seu negócio de beleza e descubra o valor do seu talento.</Text>
        <Button label="Criar minha conta" icon="arrow" onPress={() => onMode('signup')} />
        <Button label="Já tenho uma conta" secondary onPress={() => onMode('login')} />
        {/* A calculadora é a porta de entrada do produto e não fica atrás do cadastro. */}
        <Pressable accessibilityRole="button" onPress={() => onMode('calculator')} style={({ pressed }) => [s.switchButton, s.center, pressed && ui.pressed]}>
          <Text style={s.switchLink}>Calcular um preço sem criar conta</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );

  if (mode === 'calculator') return (
    <PublicCalculator
      onBack={() => onMode('welcome')}
      onSignUp={async (input: PublicPricingInput, serviceName: string) => {
        await rememberCalculation({ input, serviceName });
        setCarrying(true);
        onMode('signup');
      }}
    />
  );

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const title = isForgot ? 'Recupere seu acesso.' : isSignup ? 'Crie sua conta profissional.' : 'Seu negócio, mais organizado.';
  const subtitle = isForgot ? 'Enviaremos um link para você criar uma nova senha.' : isSignup ? 'Estamos felizes em ter você aqui.' : 'Pronta para continuar sua jornada?';
  const action = isForgot ? 'Enviar link de recuperação' : isSignup ? 'Criar minha conta' : 'Entrar';

  const submit = () => {
    if (isForgot) {
      // Recuperação por link depende de um serviço de e-mail ainda não
      // contratado. Prometer que o e-mail saiu seria mentira.
      dialog.inform({
        title: 'Ainda não disponível',
        message: 'A recuperação por e-mail está sendo preparada. Escreva para suporte@beautyconta.com.br que redefinimos sua senha.',
      });
      return;
    }
    void run(() => (isSignup ? app.signUp({ name, email, password }) : app.signIn({ email, password })));
  };

  return (
    <Screen>
      <Brand />
      <ScreenHeader title={title} subtitle={subtitle} onBack={() => onMode(isForgot ? 'login' : 'welcome')} />
      <Card>
        {error && <Notice message={error} />}
        {isSignup && carrying && <Notice tone="success" message="Assim que a conta estiver pronta, o cálculo que você acabou de fazer entra no seu histórico." />}
        {isSignup && <Field label="Nome completo" value={name} onChangeText={setName} placeholder="Digite seu nome" />}
        <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="Digite seu e-mail" email />
        {!isForgot && <>
          <Field label="Senha" value={password} onChangeText={setPassword} placeholder="Digite sua senha" secure={!revealed}
            hint={isSignup ? 'Mínimo de 8 caracteres' : undefined}
            right={<Pressable accessibilityRole="button" accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setRevealed(!revealed)} style={({ pressed }) => [s.eye, pressed && ui.pressed]}><Icon name={revealed ? 'eye-off' : 'eye'} size={18} color={colors.faded} /></Pressable>} />
          {!isSignup && <Pressable accessibilityRole="button" onPress={() => onMode('forgot')} style={({ pressed }) => [s.forgot, pressed && ui.pressed]}><Text style={ui.link}>Esqueci a senha</Text></Pressable>}
        </>}
        <Button label={busy ? 'Aguarde...' : action} icon="arrow" onPress={busy ? undefined : submit} />
        {!isForgot && <View>
          <View style={s.divider}><View style={s.dividerLine} /><Text style={s.dividerText}>ou continue com</Text><View style={s.dividerLine} /></View>
          <SocialRow />
        </View>}
        {isSignup && <Text style={s.terms}>Ao continuar, você concorda com os Termos e a Política de Privacidade.</Text>}
      </Card>
      <View style={s.switch}>
        {!isForgot && <Text style={s.switchText}>{isSignup ? 'Já possui uma conta?' : 'Ainda não possui uma conta?'}</Text>}
        <Pressable accessibilityRole="button" onPress={() => onMode(isForgot || isSignup ? 'login' : 'signup')} style={({ pressed }) => [s.switchButton, pressed && ui.pressed]}>
          <Text style={s.switchLink}>{isForgot ? 'Voltar para o login' : isSignup ? 'Entrar' : 'Criar conta grátis'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  center: { justifyContent: 'center' },
  brand: { color: colors.ink, fontSize: 23, fontWeight: '700', letterSpacing: -1 },
  brandAccent: { color: colors.accent, fontWeight: '400' },

  welcomePage: { flex: 1, paddingTop: 34, justifyContent: 'space-between' },
  welcomeTop: { alignItems: 'center' },
  welcomeArt: { height: 250, alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,.65)', borderRadius: 100, transform: [{ rotate: '-18deg' }] },
  orbitOne: { width: 230, height: 95 },
  orbitTwo: { width: 280, height: 135, transform: [{ rotate: '18deg' }] },
  welcomeArtText: { position: 'absolute', bottom: 24, color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: '600', letterSpacing: 3, textAlign: 'center', textTransform: 'uppercase' },
  welcomeSheet: { backgroundColor: colors.background, borderTopLeftRadius: 34, borderTopRightRadius: 34, padding: 26, paddingTop: 30, paddingBottom: 30 },
  welcomeTitle: { color: colors.ink, fontSize: 27, lineHeight: 33, fontWeight: '600', letterSpacing: -1, textAlign: 'center' },
  welcomeSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 11, marginBottom: 22, paddingHorizontal: 10 },

  eye: { paddingLeft: 6, paddingVertical: 6 },
  forgot: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center', marginTop: -4 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 },
  dividerLine: { height: 1, backgroundColor: colors.border, flex: 1 },
  dividerText: { color: colors.faded, fontSize: 10 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  socialButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  socialDot: { width: 8, height: 8, borderRadius: 4 },
  socialLabel: { color: colors.ink3, fontSize: 11, fontWeight: '500' },
  terms: { color: colors.faded, fontSize: 10, lineHeight: 16, textAlign: 'center' },

  switch: { alignItems: 'center', marginTop: 6 },
  switchText: { color: colors.muted, fontSize: 12 },
  switchButton: { minHeight: 40, justifyContent: 'center' },
  switchLink: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
