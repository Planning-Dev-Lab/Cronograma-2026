# **TRABALHANDO COM GIT**

1. Trabalhando na Branch de desenvolvimento

    <p>Sempre verifique se está na Branch certa antes de começar.</p>

    <!-- Garante que esteja na Brach develop -->
    - `git checkout develop`

    <!-- (Opcional) Puxa mudanças caso tenha editado algo direto no site do GitHub -->
    - `git pull origin develop`

2. Salvando na develop
    
    <!-- Adiciona as mudanças -->
    - `git add .`

    <!-- Cria o registro da alteração -->
    - `git commit -m "Descrição das mudanças"`

    <!-- Envia para o servidor (GitHub) -->
    - `git push origin develop`

3. O Merge (Levando para a **main**)

    <p>Agora que a <b>develop</b> está pronta e salva, vamos atualizar o site oficial.</p>

    <!-- Muda para a Branch principal -->
    - `git checkout main`

    <!-- Traz as novidades da develop para dentro da main -->
    - `git merge develop`

    <!-- Envia a atualização para o GitHub (isso ativa o GitHub Pages)-->
    - `git push origin main`

4. Voltando ao trabalho

    <p>Não esqueça de voltar para a "oficina" (develop) para não fazer alterações na main sem querer</p>

    <!-- DICA DE OURO PARA TERMINAL -->

    
    - `git status`<!-- Use este comando o tempo todo. Ele é o seu "GPS". Ele diz em qual Branch você está e se há arquivos esquecidos sem commit -->

    - `git log --oneline -n 5`<!-- Mostra os útimos 5 commits de forma resumida. Ótimo para conferir se o seu commit entrou mesmo -->

    - TAB para completar:<!-- No terminal, comece a digitar o nome da branch(ex: git checkout dev...) e aperte TAB. O terminal completa o nome para você, evitando erros de digitação -->

## Um comando extra útil:

- `git merge --abort`<!-- Se um dia você fizer um merge e volta tudo o que era antes -->,


5. O Editor do Git (Vim)

    <p>Às vezes, ao fazer o git merge, o Git pode abrir um editor estranho no terminal pedindo uma "mensagem de merge". Se isso acontecer e você ficar "preso", não entre em pânico:</p>

    1. Digite `:wq` (isso significa write/escrever e quit/sair).
    2. Aperte **ENTER**


6. Atalho para Sincronizar Tudo