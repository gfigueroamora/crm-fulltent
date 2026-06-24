# CRM Fulltent

CRM Comercial para Fulltent — Soluciones Modulares y Encarpados Industriales.

## Stack
- React 18
- Firebase (Firestore + Authentication)
- Vercel (deploy)

## Instalación local

```bash
npm install
npm start
```

## Deploy en Vercel

1. Sube este proyecto a GitHub
2. Ve a vercel.com → New Project → importa el repo
3. Framework: Create React App
4. Deploy (sin variables de entorno — las credenciales están en src/firebase.js)

## Agregar usuarios

Ve a Firebase Console → Authentication → Users → Add user

## Estructura
```
src/
  firebase.js        # Configuración Firebase
  constants.js       # Estados, rubros, colores
  utils.js           # Helpers y parser Excel
  seedData.js        # 459 registros iniciales
  App.js             # Auth state → Login o CRM
  components/
    Login.js         # Pantalla de login
    CRM.js           # App principal
    Modal.js         # Formulario crear/editar
```
