# CogitoPlay — le logo « Le sceau »

> Ce fichier documente le logo. Il ne fait pas partie du site.
> Le README du dépôt est celui de la racine, il n’a pas été touché.

Terracotta `#B4531F`, une seule couleur, aucun dégradé.

## À coller dans le `<head>` de chaque page

```html
<link rel="icon" href="/cogitoplay/favicon.ico" sizes="32x32">
<link rel="icon" href="/cogitoplay/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/cogitoplay/apple-touch-icon.png">
<link rel="manifest" href="/cogitoplay/site.webmanifest">
<meta name="theme-color" content="#FBFAF7">
```

L'ordre compte : les navigateurs modernes prennent le SVG, les anciens retombent sur le `.ico`.
Le `.ico` contient déjà les tailles 16, 32 et 48 px — inutile de déclarer les PNG un par un.

## Où déposer les fichiers

À la racine du dépôt GitHub Pages, c'est-à-dire dans le dossier servi à `getbybu.github.io/cogitoplay/`.
Si le dépôt est publié depuis une sous-arborescence, ajuste les chemins ci-dessus **et** `start_url` / `scope`
dans `site.webmanifest`.

## Contenu

| Fichier | Usage |
|---|---|
| `favicon.svg` | Onglet, favori, tout navigateur récent. Cadrage serré, marge 6 %. |
| `favicon.ico` | Repli 16 / 32 / 48 px. Le 16 px utilise la variante simplifiée. |
| `favicon-16x16.png` | Anneau seul, sans le point. |
| `favicon-32x32.png`, `favicon-48x48.png` | Marque complète. |
| `apple-touch-icon.png` | 180 px, fond crème `#FBFAF7`, marge iOS. |
| `icon-192.png`, `icon-512.png` | Manifest, écran d'accueil Android. |
| `icon-512-maskable.png` | Variante `maskable`, zone de sécurité 62 %. |
| `site.webmanifest` | Manifest. |
| `cogitoplay-sceau.svg` | Master 512 × 512, terracotta. |
| `cogitoplay-sceau-encre.svg` | Monochrome encre `#201D18`. |
| `cogitoplay-sceau-creme.svg` | Inversé crème `#FBFAF7`, pour fond sombre. |
| `cogitoplay-sceau-16px.svg` | Variante simplifiée, source du 16 px. |

## Un point de vigilance

À 16 px, le point de la marque complète tient mais se rapproche visuellement de l'anneau.
C'est pour ça que le 16 px du `.ico` et le `favicon-16x16.png` utilisent l'anneau seul.
Le `favicon.svg`, lui, garde le point : rendu vectoriel, il reste net quelle que soit la densité d'écran.
