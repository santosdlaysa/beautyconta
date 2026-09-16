import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { randomUUID } from 'expo-crypto';
import { GoogleSignin, GoogleSigninButton, isSuccessResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { useApp } from '../state/AppProvider';
import { ApiError } from '../lib/api';
import type { SocialLoginInput } from '../lib/resources';
import { useSubmit } from '../lib/useSubmit';
import { Button, Field, Notice } from './ui';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleConfigured = !!webClientId && (Platform.OS !== 'ios' || !!iosClientId);
if (googleConfigured) GoogleSignin.configure({ webClientId, iosClientId });

export function SocialButtons({ disabled }: { disabled: boolean }) {
  const app = useApp();
  const { busy, error, run } = useSubmit();
  const locked = useRef(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pending, setPending] = useState<SocialLoginInput | null>(null);
  const [password, setPassword] = useState('');
  useEffect(() => { void Apple.isAvailableAsync().then(setAppleAvailable).catch(() => {}); }, []);

  const complete = async (input: SocialLoginInput) => {
    try {
      await app.signInSocial(input);
      setPending(null);
      setPassword('');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) setPending(input);
      throw failure;
    }
  };
  const execute = (action: () => Promise<void>) => {
    if (disabled || locked.current) return;
    locked.current = true;
    void run(action).finally(() => { locked.current = false; });
  };
  const google = () => execute(async () => {
    setPending(null);
    setPassword('');
    try {
      if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      // Permite escolher outra conta depois de sair do BeautyConta.
      await GoogleSignin.signOut();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      if (!response.data.idToken) throw new Error('O Google não retornou a identificação. Tente novamente.');
      await complete({ provider: 'google', idToken: response.data.idToken });
    } catch (failure) {
      if (isErrorWithCode(failure) && failure.code === statusCodes.SIGN_IN_CANCELLED) return;
      throw failure;
    }
  });
  const apple = () => execute(async () => {
    setPending(null);
    setPassword('');
    const nonce = randomUUID();
    try {
      const result = await Apple.signInAsync({ nonce, requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL] });
      if (!result.identityToken) throw new Error('A Apple não retornou a identificação. Tente novamente.');
      await complete({ provider: 'apple', idToken: result.identityToken, nonce,
        name: result.fullName ? Apple.formatFullName(result.fullName).slice(0, 120) : undefined });
    } catch (failure) {
      if (typeof failure === 'object' && failure && 'code' in failure && failure.code === 'ERR_REQUEST_CANCELED') return;
      throw failure;
    }
  });

  if (!googleConfigured && !appleAvailable) return null;
  return <View style={{ gap: 12, marginTop: 14 }}>
    {error && <Notice message={error} />}
    <View pointerEvents={busy || disabled ? 'none' : 'auto'} style={{ gap: 12, opacity: busy || disabled ? 0.5 : 1 }}>
      {googleConfigured && <GoogleSigninButton style={{ width: '100%', height: 48 }} size={GoogleSigninButton.Size.Wide} color={GoogleSigninButton.Color.Light} onPress={google} disabled={busy || disabled} />}
      {appleAvailable && <Apple.AppleAuthenticationButton buttonType={Apple.AppleAuthenticationButtonType.CONTINUE} buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK} cornerRadius={8} style={{ width: '100%', height: 48 }} onPress={apple} />}
    </View>
    {pending && <View style={{ gap: 8 }}>
      <Field label="Senha da sua conta BeautyConta" value={password} onChangeText={setPassword} secure />
      <Button label={busy ? 'Aguarde...' : 'Confirmar senha e vincular'} onPress={busy || disabled || !password ? undefined : () => execute(() => complete({ ...pending, existingPassword: password }))} />
      <Button label="Cancelar" secondary onPress={busy ? undefined : () => { setPending(null); setPassword(''); }} />
    </View>}
  </View>;
}
