# creature_sorter

A small [ComfyUI](https://github.com/comfyanonymous/ComfyUI) custom extension that sorts generated outputs into folders named after the workflow that produced them.

Every Save node's `filename_prefix` is rewritten at queue time, so files land in:

```
output/<workflow_name>/<YYMMDD>/<original prefix>
```

For example, a workflow saved as `portraits/studio-v2` with a Save Image prefix of `ComfyUI` writes to:

```
output/portraits/studio-v2/261122/ComfyUI_00001_.png
```

## Status

> **Untested in a live ComfyUI.**
> - The server-side handler (`__init__.py`) has only been run against a stub `PromptServer`.
> - The frontend half (`js/workflow_name.js`) has not been run at all.
>
> Expect to debug it on first use. See [Known risks](#known-risks).

## Installation

Clone or copy this repo into ComfyUI's `custom_nodes` folder, then restart ComfyUI:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/CreaturePost/creature_sorter
```

There are no dependencies beyond ComfyUI itself. The extension registers no nodes. It only adds a prompt handler and a frontend script.

## How it works

1. **Frontend** (`js/workflow_name.js`): wraps `api.queuePrompt` and writes the active workflow's name into `workflow.extra.workflow_name` just before the prompt is queued.
2. **Server** (`__init__.py`): an `on_prompt` handler runs inside `POST /prompt`. It reads the name from `extra_data.extra_pnginfo.workflow.extra.workflow_name` and prefixes every string `filename_prefix` in the prompt with `<workflow_name>/<YYMMDD>/`.

Details:

- **Name cleaning:** a trailing `.json` is stripped. Each path segment is sanitised to word characters, `-`, `.` and spaces. Everything else becomes `_`. Subfolders in the workflow name (`a/b`) are kept as nested folders.
- **No name available:** outputs go to `unsaved/<YYMMDD>/...`.
- **Date:** this is the queue time on the server's clock, not the time the job runs.
- **Idempotent:** a prefix that already starts with the target folder isn't prefixed again.

## Using it from the API

API clients can skip the frontend and send the name directly:

```json
{
  "prompt": { "...": "..." },
  "extra_data": { "workflow_name": "my-workflow" }
}
```

## Limitations

- Only inputs named `filename_prefix` are rewritten. Savers that use a different input name are not touched.
- A `filename_prefix` wired from another node's output (a link) is skipped.
- Only the active workflow's name is used. There is no per-node override.

## Known risks

- **Silent failure on the server.** ComfyUI only logs exceptions raised by prompt handlers. If the handler fails, the prompt is left unchanged and files land in the default output folder. Check the console for `creature_sorter failed`.
- **Fragile frontend hook.** Wrapping `api.queuePrompt` isn't a documented extension point, and the property that holds the workflow name is unverified (`fullFilename`, `filename` and `path` are tried in that order). If outputs always land in `unsaved/`, check in the browser console that `app.extensionManager.workflow.activeWorkflow` exists and which property holds the saved name on your frontend version.

## Project layout

```
__init__.py           # server-side prompt handler; ComfyUI loads this
js/workflow_name.js   # frontend extension (served via WEB_DIRECTORY)
```
