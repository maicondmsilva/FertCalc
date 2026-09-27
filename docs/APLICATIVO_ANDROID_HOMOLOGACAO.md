# FertCalc Android — preparação e homologação

## Identidade

- aplicativo: FertCalc;
- application ID: `br.com.fertigran.fertcalc`;
- variante web embarcada: `pricing`;
- deep link de recuperação: `fertcalc://auth/reset-password`;
- Android mínimo: API 24;
- Android alvo/compilação: API 36.

O application ID precisa ser confirmado antes do primeiro cadastro na Google Play,
pois a loja não permite alterar o identificador de um aplicativo já publicado.

## Preparação da estação Android

1. Instalar Node.js 22 ou superior.
2. Instalar Android Studio Otter 2025.2.1 ou superior.
3. Instalar Android SDK Platform 36 e as ferramentas de build correspondentes.
4. Configurar `JAVA_HOME` com o JDK fornecido pelo Android Studio.
5. Executar `npm ci`.
6. Executar `npm run android:sync`.
7. Abrir com `npm run android:open` ou executar com `npm run android:run`.

## Configuração externa obrigatória

Em Supabase → Authentication → URL Configuration → Redirect URLs, autorizar:

```text
fertcalc://auth/reset-password
```

Nenhuma `service_role`, senha, keystore ou credencial de loja pode ser incluída no
repositório. A chave pública do cliente continua sujeita às políticas RLS.

## Roteiro de homologação em aparelho real

- instalar a compilação interna em telefone e tablet;
- entrar com e-mail e usuário e validar a restauração da sessão;
- recuperar senha pelo deep link do e-mail;
- confirmar que somente o módulo de precificação está disponível;
- calcular, editar, salvar e reabrir uma precificação;
- validar lista BRL e USD, preços temporários e rentabilidade;
- compartilhar PDF pelo seletor nativo;
- validar notificações e chat em primeiro plano e após retomada;
- conferir teclado, rolagem, modais, rotação e botão Voltar;
- desligar a rede e confirmar o alerta explícito de indisponibilidade;
- verificar ícone, splash, nome e áreas seguras do dispositivo.

## Entrega interna

A primeira entrega deverá ser um AAB/APK de homologação assinado por uma chave sob
controle da empresa. A assinatura de produção e a publicação na loja somente serão
feitas após o aceite integral do roteiro acima.
