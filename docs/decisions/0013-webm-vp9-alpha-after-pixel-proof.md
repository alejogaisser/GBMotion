# 0013. WebM VP9 with alpha enabled after an RGBA pixel proof
- Date: 2026-10-11
- Status: accepted
- Decision: The `alpha-webm` kind (`vp9`, `yuva420p`, `png` frames, `.webm`) and its UI button exist only because `validate-webm-alpha` passed. The proof decodes a frame with libvpx-vp9 to a lossless RGBA PNG and checks real pixels (alpha 0 and 255, composited over black and white). Codec or `alpha_mode` metadata alone never counts.
- Reason: Remotion's reduced ffmpeg may lack encoders or filters, and a synthetic ProRes-to-WebM conversion proves nothing about the integrated render. AC27 passed.
