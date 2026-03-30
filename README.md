# Buscaminas

Buscaminas con tema terminal retro, construido con HTML, CSS y JavaScript vanilla.

## Características

- 3 niveles de dificultad (Fácil 9x9, Medio 16x16, Difícil 30x16)
- Animación de explosión escalonada de minas
- Doble clic / doble toque para chord (revelar adyacentes)
- Long press en móvil para colocar bandera
- Diseño responsive para celular
- Tema visual estilo terminal CRT

## Cómo jugar

| Acción | Escritorio | Móvil |
|---|---|---|
| Revelar celda | Clic izquierdo | Tocar |
| Colocar bandera | Clic derecho | Mantener presionado |
| Chord (revelar adyacentes) | Doble clic | Doble toque |

## Ejecutar localmente

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/buscaminas-game.git

# Abrir en el navegador
cd buscaminas-game
open index.html
```

No requiere dependencias ni build. El juego funciona abriendo `index.html` directamente.

## Estructura del proyecto

```
buscaminas-game/
├── index.html      # Estructura HTML
├── styles.css      # Estilos y animaciones
├── game.js         # Lógica del juego
└── README.md
```

## Despliegue

Desplegado en [GitHub Pages](https://jold1992.github.io/buscaminas-game/).
