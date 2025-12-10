# Script API Reference

The `DreamMiniStage` global object provides access to the script runner API.

## Variables API
Manage persistent variables scoped to the character or session.

### `DreamMiniStage.variables.get(key: string): any`
Retrieves a variable value.
```javascript
const hasMet = DreamMiniStage.variables.get('met_hero');
```

### `DreamMiniStage.variables.set(key: string, value: any): void`
Sets a variable value. This is persisted automatically.
```javascript
DreamMiniStage.variables.set('met_hero', true);
```

### `DreamMiniStage.variables.delete(key: string): void`
Deletes a variable.
```javascript
DreamMiniStage.variables.delete('met_hero');
```

### `DreamMiniStage.variables.list(): string[]`
Returns a list of all variable keys.

## Events API
Listen to and emit events.

### `DreamMiniStage.events.on(event: string, handler: (data: any) => void): void`
Subscribes to an event.
```javascript
DreamMiniStage.events.on('message:received', (msg) => {
  console.log('New message:', msg.content);
});
```

### `DreamMiniStage.events.once(event: string, handler: (data: any) => void): void`
Subscribes to an event once.

### `DreamMiniStage.events.emit(event: string, data: any): void`
Emits a custom event.
```javascript
DreamMiniStage.events.emit('minigame:score', { score: 100 });
```

## World Book API
Access world lore and entries.

### `DreamMiniStage.worldbook.get(id: string): Promise<WorldBookEntry | null>`
Fetches a specific world book entry by ID or key.
```javascript
const entry = await DreamMiniStage.worldbook.get('city_gate');
```

### `DreamMiniStage.worldbook.search(query: string): Promise<WorldBookEntry[]>`
Searches for entries matching a query.
```javascript
const entries = await DreamMiniStage.worldbook.search('magic');
```

## Utilities

### `DreamMiniStage.utils.log(...args: any[]): void`
Logs messages to the console and the parent window's debug log.

### `DreamMiniStage.utils.waitFor(ms: number): Promise<void>`
Pauses execution for a specified duration.
```javascript
await DreamMiniStage.utils.waitFor(1000);
```
