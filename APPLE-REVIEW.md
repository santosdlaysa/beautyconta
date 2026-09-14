# Revisão Apple

## Suporte

Após a publicação do site, preencher o campo Support URL no App Store Connect
com https://beautyconta.vercel.app/suporte. A página identifica o BeautyConta,
oferece WhatsApp e e-mail e inclui links para privacidade, termos e exclusão.

## Autenticação e publicação

O ambiente EAS `production` consultado estava sem variáveis. O perfil de build
agora define explicitamente a API HTTPS e o site público. Isso evita depender
do `.env` local para essas URLs. Para EAS Update, configurar também
`EXPO_PUBLIC_API_URL=https://beautyconta.onrender.com` e
`EXPO_PUBLIC_SITE_URL=https://beautyconta.vercel.app` no ambiente EAS production:
updates não leem o bloco `build.production.env`.

A API respondeu 200 em `/health/db`. O preflight de produção não liberou a
origem do site; o backend agora inclui essa origem na lista CORS. É necessário
publicar o backend para aplicar a correção. CORS afeta o navegador e não
explica, isoladamente, uma falha de rede no aplicativo nativo.

Teste reproduzível da API: `node backend/scripts/check-production-auth.mjs`.
Cria uma conta temporária, verifica cadastro, login, logout, rejeição do token
revogado e novo login; exclui a conta ao final. Não testa a interface nativa.
Execução realizada: todas essas etapas da autenticação passaram em produção e
a conta temporária foi excluída. O comando terminou com falha somente pelo CORS,
cuja correção ainda precisava de deploy no momento do teste.

Antes do reenvio, gerar e instalar o novo build em iPad Air 11 polegadas (M3),
iPadOS 27.0: instalação limpa → cadastro → login → logout → novo login.
Verificar também o onboarding e reabertura do app. Esse teste não foi realizado
neste ambiente Windows e não deve ser declarado como concluído à Apple.

## Assinaturas

O código integra `react-native-purchases` (RevenueCat) com compras e restauração
pela App Store no iOS. A ausência da chave pública iOS agora mantém o canal da
loja e mostra indisponibilidade, sem oferecer checkout externo. Configurar
`EXPO_PUBLIC_REVENUECAT_IOS_KEY` no EAS e validar produtos, offerings, webhook e
liberação do plano em sandbox antes de afirmar que as compras estão operantes.
O ambiente EAS consultado não tinha essa chave. Não foi feita compra sandbox.

Texto em inglês para responder sobre o modelo implementado (conferir com as
perguntas exatas da Apple e com a configuração ativa antes de enviar):

> BeautyConta is a pricing and business management app for beauty professionals.
> It offers a free plan and paid subscriptions that unlock additional digital
> features and higher usage limits. In the iOS app, subscriptions use Apple's
> In-App Purchase through RevenueCat. Users can restore purchases from the plan
> screen and manage App Store subscriptions through their Apple account settings.
> The iOS app does not offer an external checkout for these digital features.
> Accounts may also access subscriptions previously purchased on the web.
> Our support page is https://beautyconta.vercel.app/suporte.

Este texto descreve o código corrigido; não confirma configuração, aprovação de
produtos ou testes no aparelho. Não foi enviada resposta à Apple.
