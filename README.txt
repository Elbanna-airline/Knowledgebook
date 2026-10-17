Knowledge book - standalone site
1) Upload this whole folder to Vercel (drag and drop, or "vercel" from the folder). No build step.
2) Each page is a thin shell (e.g. playbook.html) that loads its own file from content/.
3) Design: every page inside content/ links ../assets/page.css (one shared palette/font/cards).
   Change colours or spacing there once and all inner pages follow.
   Shell (top bar + frame): assets/inner.css.  Home page: index.html (own styles).
4) Pages: dictionary, fixed-rates, current-offers, galileo-pnr, playbook, umrah, tourism.
   A missing content file shows a friendly notice.
