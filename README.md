# VÉLO LIBRE

Application web mobile (PWA) pour préparer et suivre des balades en VTC électrique, seul ou à deux.

## Fonctionnalités incluses

- Tableau de bord et gestion de deux vélos.
- Calcul indicatif de l'autonomie à partir de la capacité, de la charge et de la consommation saisies.
- Générateur de boucles avec deux modes : automatique et personnalisé.
- Connexion configurable à un serveur Valhalla.
- Mode démonstration clairement identifié (tracés géométriques non navigables).
- Carte Leaflet / OpenStreetMap.
- Géolocalisation et enregistrement de trace tant que la page reste active.
- Import GPX et export GPX.
- Carnet de sorties avec notes et photo.
- Sauvegarde et restauration JSON.
- Stockage local IndexedDB.
- Manifeste PWA et cache de base du shell applicatif.
- Pipeline GitHub Actions pour GitHub Pages.

## Démarrer en local

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Ouvrir l'URL indiquée par Vite.

Pour vérifier la compilation :

```bash
npm run build
npm run preview
```

## Déploiement GitHub Pages

1. Déposer l'ensemble des fichiers à la racine du dépôt GitHub.
2. Pousser les changements sur la branche `main`.
3. Le workflow `.github/workflows/deploy.yml` installe les dépendances, compile Vite et publie le dossier `dist/` sur GitHub Pages.
4. Vérifier que le dernier workflow est terminé avec succès dans l'onglet **Actions**.

La configuration Vite utilise une base relative pour fonctionner sur GitHub Pages.

## Configurer Valhalla

Le générateur réel est préconfiguré avec le serveur public de démonstration FOSSGIS :

`https://valhalla1.openstreetmap.de`

Dans **Réglages > Connexion Valhalla**, cliquer sur **Enregistrer et tester la connexion**. L'adresse et l'éventuelle clé API sont conservées localement dans IndexedDB. L'application vérifie `/status`, puis envoie les demandes d'itinéraire à `/route` avec le profil vélo hybride et l'identifiant `X-Client-Id: velo-libre-do060976-afk.github.io`.

Ce serveur est public et fourni sans garantie de disponibilité. Il applique une politique d'usage raisonnable et peut limiter les requêtes. Il convient à des essais et à un usage personnel modéré, pas à un service à fort trafic. Les mainteneurs Valhalla demandent aux applications publiées à destination d'utilisateurs de les prévenir et d'identifier leurs requêtes. Voir la [documentation Valhalla](https://valhalla.github.io/valhalla/start/introduction/). Une clé API n'est pas nécessaire pour ce serveur public.

Sans serveur configuré, le mode démonstration génère des formes de boucles indicatives. Ces tracés ne suivent pas les routes réelles et ne doivent pas être utilisés pour naviguer.

### Limites du prototype de routage

- Le calcul Valhalla assemble trois points de passage et le départ.
- Le profil est orienté vélo hybride.
- Le classement est basé sur la proximité de la distance cible.
- Le dénivelé n'est pas encore calculé : il est affiché à zéro pour les routes Valhalla tant qu'un service d'altitude n'est pas intégré.
- Les préférences de difficulté et d'ambiance sont présentes dans l'interface, mais leur traduction complète en paramètres de routage reste à approfondir.
- La géométrie retournée par Valhalla est réelle, mais la génération ne garantit pas encore trois boucles parfaitement différentes ou une distance exactement égale à la cible.

## Cartes et fonctionnement hors ligne

La couche cartographique utilise les tuiles standard OpenStreetMap en ligne. Leur attribution est affichée sur la carte.

Les serveurs publics de tuiles OpenStreetMap ne constituent pas un service de téléchargement massif ni un fournisseur garanti pour le hors-ligne. Cette version ne télécharge pas de zones de cartes pour une utilisation hors connexion.

Le Service Worker met en cache le shell de l'application et certaines ressources same-origin. Les tuiles cartographiques, les services de routage et la recherche de lieux nécessitent une connexion. Pour une vraie navigation hors ligne avec fond de carte, intégrer ultérieurement un fournisseur de cartes autorisant explicitement le téléchargement ou un serveur de tuiles dédié.

## GPS et sécurité

- Le navigateur doit être utilisé en HTTPS pour autoriser la géolocalisation (localhost est accepté en développement).
- Le suivi fonctionne tant que la page reste active. Les navigateurs mobiles peuvent suspendre une PWA en arrière-plan.
- Le GPS du téléphone peut être imprécis ; vérifier les indications sur le terrain.
- Les estimations de batterie sont indicatives et ne garantissent pas l'autonomie réelle.
- Les tracés de démonstration ne sont pas des itinéraires cyclables.

## Données

Les vélos, itinéraires et sorties sont stockés localement dans IndexedDB. Les données ne sont pas synchronisées entre appareils. Exporter régulièrement une sauvegarde JSON depuis Réglages.

Les photos sont intégrées aux enregistrements locaux. Éviter les photos très volumineuses, car le stockage du navigateur est limité et peut être supprimé par le système.

## Dépendances principales

- React, TypeScript, Vite
- Leaflet et React-Leaflet
- Lucide React

## Évolutions recommandées

1. Ajouter un service d'altitude pour calculer le dénivelé.
3. Améliorer la génération de boucles et les contraintes de distance.
4. Ajouter le téléchargement de cartes hors ligne avec un fournisseur compatible.
5. Améliorer le guidage vocal et la gestion du GPS en arrière-plan (dans les limites des plateformes).
6. Ajouter une vraie gestion des points d'intérêt et une recherche géographique.
7. Ajouter tests automatisés et contrôles de qualité.

## Licence et données cartographiques

Le code de ce prototype est fourni pour adaptation et utilisation par son destinataire. Les données OpenStreetMap sont soumises à l'ODbL et nécessitent attribution. Les services externes conservent leurs propres conditions d'utilisation.
