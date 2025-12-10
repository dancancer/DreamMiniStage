# Script Runner Architecture

## Overview
The Script Runner system allows DreamMiniStage.ai to execute safe, sandboxed JavaScript code embedded within chat messages. This enables interactive storytelling features, dynamic character responses, and mini-games directly within the chat interface.

## Core Components

### 1. IframeRunner (`components/ScriptExecutor/IframeRunner.tsx`)
The React component responsible for rendering the sandboxed iframe.
- **Responsibilities**:
  - Renders the `iframe` element.
  - Manages the `postMessage` communication bridge.
  - Handles iframe resizing and content updates.
  - Synchronizes script variables and events.

### 2. Chat Bubble Frame (`public/chat-bubble-frame.html`)
The HTML template loaded inside the iframe.
- **Responsibilities**:
  - Provides the execution environment for scripts.
  - Implements the `DreamMiniStage` API shim.
  - Handles message forwarding between scripts and the parent window.
  - Manages content rendering and streaming.

### 3. Message Bridge (`lib/script-runner/message-bridge.ts`)
A utility class for type-safe cross-window communication.
- **Features**:
  - Origin validation.
  - Request/Response pattern support.
  - Message serialization.

### 4. Sandbox Context (`lib/script-runner/sandbox-context.ts`)
Defines the API available to scripts.
- **API Surface**:
  - `DreamMiniStage.variables`: Get/Set/Delete variables.
  - `DreamMiniStage.events`: Emit/Listen to events.
  - `DreamMiniStage.worldbook`: Access world lore.
  - `DreamMiniStage.utils`: Helper functions.

## Data Flow

1. **Initialization**:
   - `ChatHtmlBubble` parses markdown and extracts `<script>` blocks.
   - `IframeRunner` loads `chat-bubble-frame.html`.
   - Iframe sends `READY` message.
   - `IframeRunner` sends content and initial variables.

2. **Script Execution**:
   - Scripts run inside the iframe's isolated context.
   - API calls (e.g., `DreamMiniStage.variables.set`) are sent as `API_CALL` messages to the parent.
   - `CharacterChatPanel` processes these calls and updates the Zustand store.
   - Responses are sent back via `API_RESPONSE`.

3. **Event System**:
   - Global events (e.g., `message:received`) are dispatched by `CharacterChatPanel`.
   - `IframeRunner` forwards these to the iframe via `BROADCAST_TO_EMBEDS`.
   - Scripts listen using `DreamMiniStage.events.on`.

## Security Model

- **Sandboxing**: Iframes use `sandbox="allow-scripts allow-same-origin"`.
- **Isolation**: Scripts cannot access the parent DOM or `localStorage` directly.
- **API Gateway**: All external actions must go through the `postMessage` bridge, which is validated and controlled by the parent.
