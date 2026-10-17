Knowledge book - standalone site
1) Upload this whole folder to Vercel (drag and drop, or "vercel" from the folder). No build step.
2) Each page is a thin shell (e.g. playbook.html) that loads its own file from content/.
3) Design: every page inside content/ links ../assets/page.css (one shared palette/font/cards).
   Change colours or spacing there once and all inner pages follow.
   Shell (top bar + frame): assets/inner.css.  Home page: index.html (own styles).
4) Pages: dictionary, fixed-rates, current-offers, galileo-pnr, playbook, umrah, tourism.
   A missing content file shows a friendly notice.

v17 - Advanced page editor (assets/editor.js, layout CSS appended to assets/page.css)
  Open any page (umrah, tourism, fixed-rates, current-offers, galileo-pnr) -> "تعديل الصفحة".
  - Click any element to select it; double-click text to type; drag the handle to move anywhere.
  - Drop on the left/right edge of a block to place it side by side (columns).
  - Side panel: Add / Format / Structure / Page. Ctrl+Z / Ctrl+Y / Ctrl+S / Ctrl+D / Delete.
  - Saved with the same /api/page endpoint as before (no server changes needed).
  - Page "reset to original" is in the Page tab.
  playbook.html and dictionary.html keep their own systems (not touched).
