# Frontend CRM Pro

Application **React 18** (Create React App) avec Tailwind CSS, React Router, Recharts, Axios, react-hot-toast et **Bootstrap Icons**.

## Demarrage

```bash
npm --prefix frontend install     # depuis la racine du depot
npm run dev:frontend              # http://localhost:3000
```

Le backend doit tourner sur le port 5000 : le champ `proxy` de `package.json` redirige `/api` vers `http://localhost:5000`. Le `.env` du frontend n'est necessaire que si l'API est hebergee sur un autre domaine (`REACT_APP_API_URL`).

## Structure

```
src/
|-- index.js                    Point d'entree (importe bootstrap-icons et index.css)
|-- App.jsx                     Routes publiques et protegees (ProtectedRoute y est defini)
|-- context/AuthContext.js      Session : jeton, utilisateur, connexion, deconnexion
|-- services/
|   |-- api.js                  Instance axios, jeton automatique, deconnexion sur 401
|   '-- chatbot.js              sendMessage, getChatbotStatus, clearChatHistory
|-- hooks/useStorageStatus.jsx  Mode de stockage en direct (toasts lors d'une bascule)
|-- components/
|   |-- Layout.jsx              Navigation, mode de stockage, widget du chatbot
|   |-- ChatWidget.jsx          Assistant : cartes, reponses rapides, navigation, etat de dialogue
|   |-- Icon.jsx                Bootstrap Icons : <Icon name="people" /> et InteractionIcon
|   '-- Modal.jsx, ConfirmDialog.jsx, Pagination.jsx, SearchBar.jsx
'-- pages/                      Dashboard, Clients, ClientDetail, Prospects, ProspectDetail,
                                Opportunities, Interactions, Login, Register
```

## Icones (Bootstrap Icons)

Le paquet npm `bootstrap-icons` fournit une police d'icones embarquee dans le build (pas de CDN) :

```js
import "bootstrap-icons/font/bootstrap-icons.css";   // src/index.js
```

```jsx
import Icon from "../components/Icon";

<Icon name="people" />
<Icon name="trash" title="Supprimer" />    // libelle lu par les lecteurs d'ecran
<Icon name="check-circle" className="text-green-600 text-xl" />
```

Sans `title`, l'icone est masquee aux technologies d'assistance (`aria-hidden`). Les icones se dimensionnent et se colorent avec les classes Tailwind du texte. Le catalogue complet se trouve sur [icons.getbootstrap.com](https://icons.getbootstrap.com). Une icone ne peut pas se placer dans un `<option>` : utilisez du texte brut.

## Assistant (ChatWidget)

- Le bouton flottant ouvre la fenetre ; sur mobile elle occupe l'ecran.
- Chaque reponse du serveur contient un objet `state` : le widget le conserve et le renvoie avec le message suivant. Le serveur ne garde aucune memoire de conversation.
- La conversation est gardee dans `sessionStorage` (derniers 40 messages) le temps de l'onglet.
- `actions` : `navigate` (bouton, ou navigation immediate avec `auto`), `refresh` (le `Layout` remonte la page courante pour recharger ses donnees apres une ecriture).
- `items` : cartes cliquables qui menent a la fiche ou a la liste.
- Le texte est rendu sans HTML brut (gras et puces uniquement).
- L'en-tete indique le moteur actif (local, ou local plus OpenAI / Anthropic).

## Build

```bash
npm --prefix frontend run build     # genere frontend/build
```

Sur Vercel, `npm run vercel-build` (racine) installe et compile avec `CI=false`.
