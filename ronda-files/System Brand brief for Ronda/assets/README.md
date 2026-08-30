# RONDA — Assets exportables (Brand System v2.0)

## Archivos

- **ronda-logo-amber.svg** — logotipo para fondo `--noche` o `--barra`. Texto en Bodoni Moda, R/N/D/A en `--papel`, O en cursiva `--luz`.
- **ronda-logo-ink.svg** — logotipo para papel/impresos. Tinta sólida `--tinta`; la O conserva solo la cursiva, sin color.
- **ronda-icon.svg** — favicon / app icon, 512×512. R sola en `--luz` sobre `--noche`. Exportar a 16/32/180/512 px según destino (favicon, apple-touch-icon, PWA).
- **ronda-icons-sprite.svg** — sprite `<symbol>` con cronómetro, mesa, mapa de mesas, chip de estado y comanda. Usar con `<use href="ronda-icons-sprite.svg#icon-cronometro">`; el color se hereda de `color`/`fill: currentColor` en el elemento que lo contiene.
- **ronda-tokens.css** — variables CSS (color, radio, espaciado, breakpoints, tipografía, transiciones) con los mismos nombres que la sección 06 del brief.

## Reglas de uso

- No se aplican sombras, degradados ni estiramiento al logotipo, en ninguna variante.
- Espacio de resguardo mínimo: la altura de la R a cada lado.
- Los logos se entregan como texto vivo (no trazos) para que se puedan ajustar; conviértelos a `<path>` (outline) antes de integrarlos a un bundle de producción si el entorno de destino no carga Bodoni Moda.
- El ícono de app usa esquinas ya redondeadas (radio 104 sobre 512) — no le apliques máscara de sistema operativo adicional que vuelva a redondear.
- El sprite de iconos usa `currentColor`: cambia el color envolviendo el `<use>` en un elemento con `color: var(--vino)` (o el token que corresponda), nunca editando el SVG.
