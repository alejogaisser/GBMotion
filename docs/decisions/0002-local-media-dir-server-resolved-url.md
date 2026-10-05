# 0002. Upload the video to a local media folder and serve it to the render by a server-built URL
- Date: 2026-10-04
- Status: accepted
- Decision: The picked video is uploaded once to `POST /api/media` and stored in `GB_MEDIA_DIR` (default `%LOCALAPPDATA%\gb-motion\media`, outside OneDrive; resolved to an absolute path). Burn-in renders use `<OffthreadVideo>` with `http://127.0.0.1:<port>/media/<id>`, built server-side from `mediaId`; any `src` sent by the client is stripped. Burn-in uses the chosen app format (crop to fill) at 30 fps, and cleaning the media folder is manual.
- Reason: The render process cannot open tab blobs, and OffthreadVideo does not accept `file://`. The same upload also lets the video re-link after a reload. The user approved the format and cleanup trade-offs.
