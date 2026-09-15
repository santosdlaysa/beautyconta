# BeautyConta mobile — EAS Update

## Firebase Analytics no Android

O arquivo `google-services.json` registra o pacote
`com.laysadiniz.sweetpricing`. `android.googleServicesFile` no `app.json`
configura o Google Services no prebuild, e o plugin local
`plugins/withFirebaseAnalytics.js` adiciona o SDK nativo de Analytics.
O projeto Android local também está configurado para builds pelo Gradle.

Esta integração coleta os eventos automáticos do SDK. Os eventos personalizados
de `lib/analytics.ts` ainda não estão conectados ao Firebase. O iOS precisa de
registro e configuração próprios.

Para gerar o AAB, na pasta `android/`:

```powershell
$env:NODE_ENV='production'
.\gradlew.bat bundleRelease --console=plain
```

Para validar, instale um build novo em um aparelho Android com internet,
conecte-o por USB com depuração habilitada e execute:

```powershell
adb shell setprop debug.firebase.analytics.app com.laysadiniz.sweetpricing
```

Abra o aplicativo e confira **Analytics > DebugView** no Firebase. Depois do teste:

```powershell
adb shell setprop debug.firebase.analytics.app .none.
```

O AAB não é instalável diretamente; para teste local, gere um APK com
`.\gradlew.bat assembleRelease`. A assinatura de release usa a chave de upload
indicada em `credentials.json`. Esse arquivo e o keystore devem existir localmente
e permanecem fora do Git. O plugin `plugins/withAndroidReleaseSigning.js` preserva
essa configuração no prebuild; a ausência das credenciais interrompe o build.

Referências: [SDK Android](https://firebase.google.com/docs/android/setup)
e [DebugView](https://firebase.google.com/docs/analytics/debugview).

O projeto está configurado para receber atualizações de JavaScript e assets
no Android e no iOS pelo EAS Update do projeto `beauty-conta/beautyconta`.
Os perfis de build `preview` e `production` recebem atualizações dos canais
de mesmo nome e usam os ambientes EAS correspondentes.

## Antes de usar pela primeira vez

No painel do projeto Expo, em Environment variables, configure nos ambientes
`production` e `preview`:

- `EXPO_PUBLIC_API_URL`: endereço HTTPS público do backend BeautyConta.
- `EXPO_PUBLIC_SITE_URL`: `https://beautyconta.vercel.app`.

Use visibilidade Plain text ou Sensitive. Essas URLs são públicas e entram no
bundle; não use Secret. Os comandos de update usam `--environment` para ler
as variáveis do EAS, assim como os builds. Não dependem do `.env` local.

É necessário gerar e instalar um novo build com `expo-updates`. Versões
anteriores sem esse módulo não passam a receber updates apenas publicando um.

Execute os comandos a partir de `mobile/`:

```powershell
# iOS: gerar e depois enviar o build para TestFlight/App Store.
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production

# Android: gerar e distribuir um build para habilitar updates também nele.
npx eas-cli build --platform android --profile production
```

Para testar em distribuição interna, gere um build com `--profile preview`.
O perfil de desenvolvimento continua destinado ao Metro e ao development client.

## Publicar atualizações depois do novo build

```powershell
# Testar primeiro em um build preview instalado.
npm run update:preview -- --platform ios --message "Teste da alteração"

# Publicar para os builds iOS de produção compatíveis.
npm run update:production -- --platform ios --message "Descrição da alteração"

# Publicar para Android e iOS.
npm run update:production -- --platform all --message "Descrição da alteração"
```

O app verifica atualizações ao abrir e baixa em segundo plano. Depois do
download, a atualização é aplicada na próxima inicialização. Para conferir
em um aparelho, abra com internet, aguarde o download e feche completamente
e reabra o aplicativo. O Expo Go não substitui esse teste em um build instalado.

## Compatibilidade

A política `runtimeVersion: fingerprint` calcula a compatibilidade a partir
do projeto nativo. Mudanças que alterem esse fingerprint (por exemplo,
dependências nativas, SDK ou configuração nativa) exigem um novo build;
os builds antigos não recebem um update com runtime diferente.
Mantenha as dependências e a configuração correspondentes ao build ao
publicar uma correção destinada a ele.

Preparar a configuração não publica atualizações nem gera builds remotos.

Referências: [configuração do EAS Update](https://docs.expo.dev/eas-update/getting-started/)
e [compatibilidade de runtime](https://docs.expo.dev/versions/v57.0.0/sdk/updates/#runtime-version).
