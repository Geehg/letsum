# Olympia SM3 reference reconstruction — 2026-10-28

## Sources and observations
- Primary appearance: https://www.typewriters101.com/store/p578/1956_Olympia_SM3.html — the seller identifies a 1956 green SM3; serial not verified. Photos 1–4 show side profile, exposed chrome cheek, concentric knob, continuous return arm, skirt band and tall rounded keys. Photos 5–6 show open underframe and key linkages; 7–8 show ribbon fork, card holders and type basket. Do not copy these photos into distributed assets.
- Supplemental structure: https://typewriterdatabase.com/1957-olympia-sm3.22555.typewriter — Matt Watkins #1103959, a gray machine with brown keys. Used for lid-open view only, not green color or keyboard configuration.
- Manual: https://site.xavier.edu/polt/typewriters/OlympiaSM3.pdf — primary manufacturer manual hosted by Richard Polt. Not factory CAD.

## Construction
Independent Blender shell and hood boundary geometry, deep scalloped opening, separate rolled chrome strips, high shoulder profile, open lower frame with individual linkages, taller dished green keycaps, carriage cheeks and stepped concentric knobs, long downturned return lever. Embedded micro-normal and roughness maps distinguish crinkle enamel, smooth key resin and polished metal. Existing generated Olympia transparent emblem is reused (not manufacturer's original artwork).

## Limits
Photo-derived visual reconstruction. All dimensions, curvature, microfinish, linkage spacing and motion are authored, not measured. Unreadable secondary legends omitted. Key arrangement has 44 primary keys plus 7 controls/space; blank legends are deliberate. Hidden mechanisms are incomplete. Connected to the local typing engine with the same GLB and embedded materials; not deployed to production.

## Files
- tools/modeling/build_olympia_reference.py
- tools/check_olympia_reference.py
- html/olympia-reference-review.html
- html/js/olympia-reference-review.js
- html/img/typewriters/reference/olympiasm3-reference.glb
