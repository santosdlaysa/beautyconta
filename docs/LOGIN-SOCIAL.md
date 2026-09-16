# Login Google e Apple

O app nativo envia um ID token para `POST /api/sessions/social`. O servidor verifica a assinatura com as chaves oficiais, emissor, destinatário, validade e e-mail verificado. A identidade persistida é o par provedor + `sub`; o e-mail não substitui essa identificação. Apple também usa nonce. Facebook foi removido.

Novas contas seguem o onboarding existente. Se o e-mail já existir, a tela pede a senha atual antes de vincular o provedor. Contas criadas apenas com outro provedor devem continuar usando o provedor original; não há vinculação entre duas contas sociais sem senha nesta versão. O nome Apple pode vir somente na primeira autorização; na ausência dele é usado “Profissional”, editável no perfil.

## Configurar Google

1. No projeto Google Cloud, configurar a tela de consentimento e criar um cliente OAuth **Web** para o backend. Copiar seu ID para `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` no ambiente do app e `GOOGLE_CLIENT_IDS` no servidor. Este último aceita IDs separados por vírgula.
2. Criar um cliente OAuth **iOS** para `com.beautyconta.app`. Copiar seu ID para `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `app.config.js` deriva o URL scheme de retorno a partir dele.
3. Para Android, criar o cliente OAuth Android com pacote `com.laysadiniz.sweetpricing` e SHA-1 da assinatura usada (inclusive a assinatura do Google Play). Usar o mesmo projeto do cliente Web.
4. Colocar os IDs públicos nos ambientes EAS usados pelas builds e atualizações. O Firebase Analytics existente não configura esses clientes automaticamente. Não inserir client secret no app.

Sem os IDs necessários, o botão Google fica oculto. O servidor recusa Google se `GOOGLE_CLIENT_IDS` estiver vazio.

## Configurar Apple

O projeto contém `ios.usesAppleSignIn: true` e o plugin `expo-apple-authentication`. A capacidade Sign in with Apple deve estar habilitada para o identificador `com.beautyconta.app` no Apple Developer e no provisionamento da nova build. O servidor aceita esse bundle ID por padrão; `APPLE_CLIENT_IDS` permite configurar outros explicitamente.

O botão nativo Apple aparece somente em aparelhos compatíveis. A integração Apple é para iOS; os botões sociais nativos não aparecem na versão web. A validação do ID token usa chaves públicas da Apple e não precisa de chave privada Apple.

## Aplicar e testar

1. Publicar o backend com a migração `20260916120000_social_identities` (`npm run db:deploy` no ambiente de destino; o comando `start` também aplica migrações).
2. Gerar uma **nova build nativa**. Estes módulos não podem ser adicionados por atualização OTA; Google não funciona no Expo Go. Não enviar esta mudança por OTA a builds antigas.
3. Em aparelho iOS/TestFlight, testar criação, saída e reentrada com os dois provedores, cancelamento, Apple com Ocultar Meu E-mail e confirmação de senha em conta existente. Conferir retorno à conta/negócio correto e persistência da sessão após reiniciar o app.
4. Conferir exclusão de conta e novo cadastro; a migração exclui as identidades sociais em cascata com a conta.

Os testes automatizados usam JWTs assinados e verificam tokens adulterados, expirados, emissor/audience incorretos, nonce, vínculo protegido por senha e uso da sessão. Não substituem a homologação com contas reais nos provedores.

Referências: [Expo AppleAuthentication SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/), [Google Sign-In no Expo](https://react-native-google-signin.github.io/docs/setting-up/expo), [validação Google no backend](https://developers.google.com/identity/sign-in/ios/backend-auth).
