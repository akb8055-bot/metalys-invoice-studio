# Metalys Invoice Studio

Browser-based proforma and tax invoice generator for Metalys Enclosures Manufacturing.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## GitHub Pages

Push the `main` branch to GitHub, then open **Settings > Pages** in the repository and select **GitHub Actions** as the source. The workflow in `.github/workflows/deploy-pages.yml` builds and publishes the site automatically.

Documents, saved drafts, and uploaded branding remain in each user's browser storage. Purchase-order parsing and OCR run locally in the browser; files are not sent to a server.