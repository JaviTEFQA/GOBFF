# Cobertura de las historias BFF · 26.10.100

Qué historia del BFF (fixVersion 26.10.100, 30 historias) cubre cada prueba automática, y qué TCs
manuales enlazados a la historia automatiza. Los TCs manuales que no se automatizan llevan el motivo.

Leyenda: ✅ automatizado · 🟡 automatizado en parte (falta un dato o un caso) · ⛔ no automatizable desde la web 26.10 (motivo) · ❌ bug abierto.

| Historia | Tema | Pruebas automáticas | TCs manuales automatizados | No automatizados (motivo) |
|---|---|---|---|---|
| GO-35091, GO-35097, GO-35103, GO-35115 | CDVR en `go-bff` (GraphQL) | `grabaciones/agendar-cancelar` (episodio, vía web) | — | ⛔ Son cambios del esquema GraphQL de go-bff (`entireSeason`, `recordingLevel`, `ENTIRE_SEASON`); la web 26.10 llama a canoway, no a go-bff. Se cubren de forma indirecta con las reglas de grabaciones de GO-36303/GO-36297. |
| GO-35216, GO-35292 | Miniaturas: hasThumbnails | `contenidos/miniaturas` (MULTISTC-76671) | 52070 | — |
| GO-35284 | Search Revamp: API | — | — | ⛔ 43488, 43489, 43490, 54457: la web 26.10 no llama a `nsh/search*` (la búsqueda no pasa por canoway). |
| GO-35871 | Search Revamp: borrar histórico | — | — | ⛔ Igual que GO-35284. |
| GO-35350, GO-35725, GO-35955, GO-35973 | Publicidad: hasAds / hasPrerollAds | `contenidos/anuncios` (MULTISTC-76670) | 54044, 54642, 65318, 54584 | El zapping con publicidad (GO-35955) solo aplica en España; en DE se valida la propagación. |
| GO-35633, GO-35694 | Detail Page: endpoints, botones y metadata | `fichas/barras-y-botones` (MULTISTC-76678), `fichas/error-pid` (MULTISTC-76679), `fichas/comercializacion`, `fichas/contrato/unified-detailed` | 61944, 61945, 61946, 61947, 61949, 68837, 68838, 53538, 53539, 53540, 53541, 53542, 53545, 53547, 53626, 53627, 53628 | 🟡 61943 (canal oculto), 53543/53544 (E2E), 53546 (lista de campos deprecados no documentada), 53551 (triángulos en versiones anteriores), 68839: necesitan datos o versiones que la web no da. |
| GO-36002 | Contenidos editoriales en carrusel | `home/contrato/carousel` | — (sin TCs manuales) | 🟡 Solo contrato: la historia no tiene TCs con reglas. |
| GO-36090 | HomeZone y ClientZone | `homezone/coherencia`, `homezone/contrato/check`, `homezone/dispositivos` (MULTISTC-76685), `homezone/contrato/dispositivos` (MULTISTC-76690) | 60861, 60862, 60863, 60864 | ⛔ 60865–60873: renombrar, borrar y cerrar sesión de dispositivos son mutaciones que desloguean dispositivos (riesgo de bloqueo SSO); 60865 necesita un 5xx de APIHub. |
| GO-36163 | Redirecciones: salida | `contenidos/redirecciones-salida` (MULTISTC-76676) | 65481, 65482, 65483 | — |
| GO-36175 | Redirecciones: entrada | — | — | ⛔ 69337: la web 26.10 no tiene ruta de entrada por `uniqueId` (no llama a `unified-detailed?uniqueId=`). |
| GO-36266 | Watermarking | `canales/marca-de-agua` (MULTISTC-76672) | 65250 | — |
| GO-36297 | Recordings: unified-detail | `fichas/propio-contenido`, `grabaciones/ficha-serie` (MULTISTC-76686), `grabaciones/contrato/ficha-serie` (MULTISTC-76692) | 68552, 68554, 68557 | ⛔ 68553: la web no envía `status=scheduled` y la firma impide añadirlo (revisado: no es bug, ver nota). 68555, 68556: necesitan grabación en curso o cambiar el KV. |
| GO-36303 | Recordings: seasons (agendar, cancelar, borrar) | `grabaciones/agendar-cancelar` (episodio, MULTISTC-76659), `grabaciones/agendar-cancelar-serie` (serie entera, MULTISTC-76698) | 67784, 67786, 67787 | ❌ 67780: borrar temporada falla (GO-37996). ⛔ 67776, 67779: la web DE no ofrece grabar/cancelar temporada (KV `ALLOWED_RECORDING_LEVELS` con season=false). ⛔ 67777, 67778, 67788: cuerpos a medida (firma de canoway). |
| GO-36315 | Rent & Subscription: endpoints | `suscripciones/estado` (MULTISTC-76683), `suscripciones/en-ficha` (MULTISTC-76684), `suscripciones/contrato/ficha` (MULTISTC-76689) | 68314, 68315, 68316, 68317, 68322, 68323, 68324, 68325, 68326, 68327 | ❌ Contenidos ofrecidos con suscribir cuya ficha da 404 (GO-37995): 76684 se omite. 🟡 68318–68321: la cuenta solo tiene un paquete activo; los otros estados se comprueban con la captura sintética. ⛔ 68313: la web no llama a `nsh/userinfo`. |
| GO-36384 | Unique ID: catchup como LSC | `contenidos/catchup-lsc` (MULTISTC-76675) | 68673, 68674, 68675, 68677, 69605 | ⛔ 68676, 68678, 68679, 69604, 69606, 69614, 62719: bookmark/resume del usuario, otras versiones y dispositivos, o UI. |
| GO-36521 | Settings: widget dinámico type 63 | `ajustes/widgets`, `ajustes/contrato/settings`, `ajustes/contrato/webview` (MULTISTC-76691) | 60069, 60070, 60071 | 🟡 La cuenta no tiene widget type 63: las reglas se activan cuando aparezca. 60821: distintos tipos de cliente. |
| GO-36535 | PIN de la sección de adultos | `control-parental/pin-adultos` (MULTISTC-76674) | 61142, 61144, 61146, 61147, 61148, 61149, 61150 | ❌ 61150: falta `requiresPin` en la raíz de ThematicSitePage (GO-37994). 🟡 Sin contenido adulto en la cuenta: el caso `true` se comprueba con la captura sintética. |
| GO-36549 | Iconos LSE y AD | `fichas/iconos-lse-ad` (MULTISTC-76681) | 64207, 64208, 64209, 64210 | 🟡 Sin contenidos con LSE/AD en la captura: se valida el formato y la coherencia. |
| GO-36571 | Ficha deportiva | `fichas/deportes` (MULTISTC-76680) | 67886, 67887, 67888, 67889, 67891 | 🟡 Las reglas de isSport=true se activan cuando la captura abra una LSR deportiva. 67890, 67892: datos preparados. |
| GO-36781 | Rent & Subscription: Ajustes | `suscripciones/listas` (MULTISTC-76682), `suscripciones/contrato/contratadas` (MULTISTC-76687), `suscripciones/contrato/disponibles` (MULTISTC-76688) | 65309, 65310, 65311, 65313, 65314, 65315 | ⛔ 65312, 65316: necesitan un fallo del resolvedor de APIHub. |
| GO-36810 | Relacionados (Similares) | `fichas/relacionados` (MULTISTC-76677) | 65576, 65577 | — |
| GO-36935 | Filtrado de contenidos infantiles | `canales/infantil` (MULTISTC-76673) | 64665 | 🟡 La cuenta no tiene perfil infantil: la regla de filtrado se activa al capturar con uno. |

## Bugs abiertos (fixVersion 26.11.100, Minor)

| Bug | Qué pasa | Especificación | Detectado por |
|---|---|---|---|
| GO-37994 | `GET nsh/thematic-site-page/{pid}` no trae `requiresPin` en la raíz (ThematicGridPage sí). Comprobado en 5 áreas temáticas. | GOSPECS-4825 §2.3.1 | MULTISTC-61150, MULTISTC-76674 (en rojo) |
| GO-37995 | 11 películas de catchup de canales Pay-TV de "Beliebt im Pay-TV" (home) vienen con `isSubscribeVisible=true`, pero su `unified-detailed` responde 404. La web 26.10 hoy no las pinta. | GOSPECS-4530 §2.3.1, GOSPECS-4714 | MULTISTC-76684 (omitida) |
| GO-37996 | Borrar temporada (`DELETE nsh/recordings/RSE…`) responde 400 `RecordingUnknownError` (230111), aunque la ficha ofrece "Staffel löschen". El servicio de grabaciones responde `version 26.06.100-RA`. | GOSPECS-4763 §2.2 | MULTISTC-67780 |

## Revisado y descartado como bug (09/11/2026)

- **"Geplante Aufnahmen" sin `status=scheduled` (MULTISTC-68553).** La web no envía `status`, pero el BFF devuelve el árbol con la temporada futura (`isFutureSeason`) y la web pinta bien la pestaña "Geplant". La spec dice "mantenemos el comportamiento actual" sin `status`. No se puede probar `status=scheduled` desde fuera: la firma cubre la query (401 si se añade).
- **Tarjetas de canal (LCH) y de grabación (RSR) del carrusel sin `requiresPin` (MULTISTC-61144).** La spec pide `requiresPIN` por contenido y en web los contenidos adultos son VOD; canales y grabaciones no aplican.
- **`uniqueId` opcional en la home.** La spec (MULTISTC-65481) solo lo exige en la ficha, y ahí viene siempre (MOV, SER, LSR).

## Datos que la cuenta no tiene: captura sintética

`npm run synthetic` parte de la captura real y genera dos capturas: una con los casos que faltan tal como los pide la spec (perfil infantil, sección de adultos, ficha deportiva, LSE/AD, widget type 63, paquetes en contratación/cancelación/no contratado) y otra con un defecto plantado en cada caso. Lanza las 6 pruebas afectadas y comprueba que con la primera pasan y con la segunda fallan. No valida el BFF: valida que las reglas se activan y detectan el fallo cuando esos datos lleguen.

## Estado de la cuenta de pruebas

- **Espacio de grabación.** El 09/11/2026 se borraron 5 grabaciones de ZDF-Morgenmagazin (de 100 % a 85 % usado). Las series grabadas (sobre todo "Nachrichten" de ntv, cada hora) lo vuelven a llenar: si las mutaciones de grabación se omiten por `420 RecordingSubscriberQuotaExceeded`, hay que volver a liberar espacio.
