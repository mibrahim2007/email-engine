> **Shard of [Architecture](../../Email%20Engine%20Architecture.md) §11.**
> Derived file — edit the source document and re-shard, never this copy.

## 11. Unified project structure

```
email-engine/
├── apps/web/
│   ├── src/app/                   routes (§9.1)
│   ├── src/components/            app-specific components
│   ├── src/server/                backend (§10.1)
│   ├── src/hooks/
│   ├── public/
│   ├── next.config.ts
│   └── vercel.json                crons
├── packages/
│   ├── db/{schema,repositories,migrations,seed}
│   ├── email/{parse,sanitize,thread,render}
│   ├── ai/{agent,tools,retrieval,prompts,evals}
│   ├── ui/{components,lib,styles}
│   └── config/{eslint,tsconfig,tailwind}
├── docs/
│   ├── brief.md
│   ├── prd.md            → sharded into prd/
│   ├── architecture.md   → this file, sharded into architecture/
│   ├── front-end-spec.md
│   ├── stories/          {epic}.{story}.md
│   └── qa/{assessments,gates}
├── .bmad-core/
│   ├── core-config.yaml
│   ├── agents/  tasks/  templates/  checklists/
├── e2e/
├── turbo.json
└── package.json
```

---

