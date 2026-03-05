# Launchpad 🚀 — מה-AI אל הלומד

> פלטפורמת ענן להפיכת תוצרי HTML שנוצרו ב-AI למוצרי למידה יציבים ותקניים.

## הבעיה שנפתרת

קבצי HTML שנוצרו על ידי AI (Gemini, ChatGPT, Claude) מכילים לעתים קרובות קישורים ארעיים לתמונות, וידאו ואודיו. קישורים אלה עלולים להישבר ללא התראה, ומותירים את הלומד עם תוכן ריק. Launchpad מחלץ, שומר ומשגר את התוצר כמוצר למידה יציב.

## ארכיטקטורה

```
launchpad/
├── server.js          # Express API server
├── src/
│   ├── parser.js      # HTML parser + media downloader
│   └── packager.js    # ZIP packager (Resources & SCORM 1.2)
├── public/
│   ├── index.html     # Hebrew RTL upload portal
│   ├── style.css      # UI styles
│   └── app.js         # Client-side logic
├── uploads/           # Temporary upload staging (gitignored)
├── output/            # Generated ZIPs (gitignored)
└── temp/              # Downloaded assets staging (gitignored)
```

## מסלולי עיבוד

| מסלול | תוכן החבילה (ZIP) | יעד |
|-------|-------------------|-----|
| **תיקיית משאבים** | `index.html` + `assets/` (מדיה יציבה) | וואטסאפ, מובייל, אתר פנימי |
| **חבילת SCORM** | `imsmanifest.xml` + `index.html` + `scorm_api.js` + `assets/` | קמפוס דיגיטלי (Moodle, SAP LO וכו') |

## התקנה והרצה

```bash
npm install
npm start
# → http://localhost:3000
```

### משתני סביבה

| משתנה | ברירת מחדל | תיאור |
|-------|------------|-------|
| `PORT` | `3000` | פורט השרת |

## API

### `POST /api/process`

| שדה (form-data) | סוג | תיאור |
|-----------------|-----|-------|
| `htmlFile` | File | קובץ HTML (עד 10 MB) |
| `title` | string | כותרת התוצר |
| `mode` | `resources` \| `scorm` | מסלול עיבוד |

**תגובה:**
```json
{
  "success": true,
  "jobId": "uuid",
  "downloadUrl": "/api/download/uuid/filename.zip",
  "mode": "scorm",
  "title": "מדיניות אבטחת מידע",
  "assetsCount": 7,
  "warnings": []
}
```

### `GET /api/download/:jobId/:filename`

מחזיר את קובץ ה-ZIP להורדה.

### `GET /api/health`

בדיקת זמינות: `{ "status": "ok", "version": "1.0.0" }`.

## SCORM API

ה-shim המוזרק (`scorm_api.js`) חושף על `window`:

```js
window.SCORM.setCompleted();          // סמן כהושלם
window.SCORM.setPassed(85);           // סמן כעבר עם ציון 85
window.SCORM.setScore(85, 0, 100);    // הגדר ציון בלבד
```

## רישיון

MIT
