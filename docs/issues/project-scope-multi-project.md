# fix: корректное отображение project-scope и поддержка установки в несколько проектов

## Проблема

При запуске `ide-agents` из проекта A UI показывает иконку папки (Project scope) как активную для артефактов, установленных в проект B. Поле **Project path** при этом отображает путь A (launch cwd), что создаёт ложное впечатление, что артефакт установлен в текущий проект.

### Воспроизведение

1. Установить агент/скилл в project scope для `/code/auth`
2. Запустить `ide-agents` из `/code/personal-area`
3. Открыть Agents/Skills → иконка папки горит, Project path = `personal-area`, но symlink'ов в `personal-area/.cursor/` нет

### Корневая причина

В `buildRows` (`web/src/pages/ArtifactListPage.tsx`) флаг `project` берётся из `installation.project` без сравнения `installation.projectPath` с `defaultProjectPath`:

```ts
return {
  artifact,
  global: existing?.global ?? false,
  project: existing?.project ?? false,  // ← не учитывает текущий проект
  projectPath: defaultProjectPath,
  installationId: existing?.id ?? null,
};
```

### Реальный кейс

`m2-design` + 4 скилла установлены в `/Users/cernovsergej/code/auth`. При запуске из `/Users/cernovsergej/code/personal-area` UI показывал активную иконку папки и путь `personal-area`, хотя `.cursor/` в `personal-area` отсутствует.

---

## Ограничение текущей модели

`Installation` хранит один путь (`src/shared/api-types.ts`):

```ts
global: boolean;
project: boolean;
projectPath: string | null;
```

Один артефакт = один project path. Установка в новый проект перезаписывает предыдущий (`rowsToInstallations` пишет `defaultProjectPath` при включении project scope). Это не соответствует ожиданию: **один скилл/агент может быть установлен в несколько проектов одновременно**.

---

## Ожидаемое поведение

### 1. UI отражает состояние текущего проекта

| Состояние | Иконка папки | Project path |
|-----------|--------------|--------------|
| Установлен только в `auth`, launch из `personal-area` | выключена | `personal-area` (launch cwd) |
| Установлен в `personal-area`, launch из `personal-area` | включена | `personal-area` |
| Установлен в `auth` и `personal-area`, launch из `personal-area` | включена | `personal-area` |
| Global scope включён | глобус горит независимо | — |

**Иконка папки** = «установлено в **этот** проект», а не «project scope включён где-то».

### 2. Мультипроектная установка

- Включение Project scope при launch из `personal-area` **добавляет** проект в список, не снимая установку с `auth`
- Выключение Project scope при launch из `personal-area` **удаляет symlink только из `personal-area`**, установка в `auth` остаётся
- Global и Project scope независимы (как сейчас)

### 3. Прозрачность в UI

Если артефакт установлен в другие проекты, но не в текущий — показать подсказку, например:

> Установлено в: auth, articles

или badge «+2 projects».

---

## Предлагаемые изменения

### Модель данных

Заменить `project: boolean` + `projectPath: string | null` на:

```ts
projectPaths: string[]  // нормализованные абсолютные пути
```

**Миграция** в `config.ts`:

- `{ project: true, projectPath: "/code/auth" }` → `{ projectPaths: ["/code/auth"] }`
- `{ project: false, projectPath: "/code/auth" }` → `{ projectPaths: [] }`  
  (путь при `project: false` сейчас хранится для удаления symlink — учесть при миграции)

### Backend (`apply.ts`, `targets.ts`, `server.ts`)

- `applyInstallations`: создавать/удалять symlink'и для **каждого** пути из `projectPaths`
- `getArtifactTargets`: проверять наличие symlink в `defaultProjectPath` (query `?projectPath=`) — для UI текущего проекта
- `PUT /api/installations`: при toggle project ON → `projectPaths.push(defaultProjectPath)`; при OFF → `projectPaths.filter(p => p !== defaultProjectPath)`
- `removeInstallationSymlinks` при полном удалении installation — чистить все пути из `projectPaths`

### Frontend (`ArtifactListPage.tsx`, `artifactRow.ts`, `ArtifactCard.tsx`)

- `buildRows`:
  ```ts
  project: existing?.projectPaths?.includes(defaultProjectPath) ?? false
  ```
- `rowsToInstallations`: обновлять `projectPaths` add/remove по текущему `defaultProjectPath`, не перезаписывать весь список
- Логика зависимостей агент→скиллы (`installedAgentsUsingSkillInScope`, `deletableDependentSkillsForAgentInScope` и т.д.): scope `project` = «установлен в **текущий** project path», не «есть любой project path»
- Опционально: список других `projectPaths` в карточке артефакта

### Тесты

- UI: project toggle OFF в cwd A при установке в A+B → остаётся только B
- Apply: symlink'и в обоих проектах после двойной установки
- Миграция старого config
- Регрессия: global scope, agent dependencies, gitignore managed block

---

## Критерии приёмки

- [ ] Запуск из проекта без установок — иконка папки **не горит** (даже если артефакт установлен в другом проекте)
- [ ] Включение Project scope добавляет symlink в launch cwd, не трогая другие проекты
- [ ] Выключение Project scope удаляет symlink только из launch cwd
- [ ] Один артефакт может быть установлен в N проектов одновременно
- [ ] `GET /api/repos/:id/artifacts?projectPath=...` корректно отражает `targets.project` для запрошенного пути
- [ ] Старый `config.json` мигрируется без потери установок

---

## Затронутые файлы

| Область | Файлы |
|---------|-------|
| Типы | `src/shared/api-types.ts`, `src/types.ts` |
| Миграция | `src/config.ts` |
| Apply | `src/apply.ts`, `src/adapters/create.ts` |
| API | `src/server.ts`, `src/targets.ts` |
| UI | `web/src/pages/ArtifactListPage.tsx`, `web/src/components/artifactRow.ts`, `web/src/components/ArtifactCard.tsx` |
| Тесты | `src/apply.*.test.ts`, новые unit-тесты для `buildRows` |

---

## Вне скоупа (отдельные задачи)

- Выбор произвольного project path в UI (не только launch cwd)
- Массовая установка «во все recent projects»
- Отображение project scope в списке репозиториев на Settings

---

## Альтернатива: разбить на две задачи

1. **hotfix UI** — быстрый фикс: `project` active только если `projectPath === defaultProjectPath` (без смены модели)
2. **feat: multi-project installations** — полноценная поддержка `projectPaths[]`
