# Backlog do Projeto - Aplicativo Analisador de Espectro

Este arquivo registra o histórico de tarefas, ajustes, correções e incrementações executadas no projeto.

---

### [2025-05-18 10:00] Análise de Viabilidade Técnica e Inicialização
- **Tarefa Executada:** Análise da SPEC (`Spec/Welcome file.html`) e verificação de viabilidade técnica.
- **Conclusão de Viabilidade:**
  - **Aplicações SPA com Vanilla JS + HTML5 + CSS3:** 100% viável e ideal para hospedagem no GitHub Pages sem dependências de backend.
  - **Analisador de Espectro:** Viável utilizando `AudioContext` e `AnalyserNode` da Web Audio API combinados com `CanvasRenderingContext2D` e `requestAnimationFrame` para renderização em tempo real a 60 FPS.
  - **Alteração de Frequência de Terapia (Ajuste de Pitch e Inserção de Tom Senoidal):** Viável utilizando ajuste de `playbackRate` / detune para afinação e `OscillatorNode` / `GainNode` para sobreposição de frequências de Solfeggio (174Hz - 963Hz e personalizadas).
  - **Exportação/Salvar Áudio:** Viável via `OfflineAudioContext` renderizando o buffer de áudio com as alterações e exportando como arquivo `.wav` baixável no navegador.
- **Resultado:** Projeto 100% viável tecnicamente.

---

### [2025-05-18 10:30] Desenvolvimento da Interface SPA (Mobile-First)
- **Tarefa Executada:** Implementação da estrutura HTML5 (`index.html`) e estilos CSS3 (`style.css`).
- **Detalhes:**
  - Layout responsivo mobile-first com design moderno (dark theme, glassmorphism e micro-animações).
  - Componentes para drag & drop de arquivos de áudio, player de mídia com controles (Play, Pause, Stop, Volume, Seek bar), modos do visualizer de espectro, painel de afinação de pitch, gerador de tons de Solfeggio com presets e entrada customizada de Hz, e botão de exportação.

---

### [2025-05-18 11:00] Implementação do Motor de Áudio & Visualizador de Espectro
- **Tarefa Executada:** Criação da lógica de áudio e renderizador Canvas em `app.js`.
- **Detalhes:**
  - Leitura e decodificação assíncrona de arquivos de áudio (MP3, WAV, OGG, M4A) via FileReader e `AudioContext.decodeAudioData`.
  - Construção do grafo de áudio Web Audio API (`AudioBufferSourceNode`, `AnalyserNode`, `GainNode`).
  - Renderizador em Canvas HTML5 a 60 FPS com 3 modos de visualização: BARRAS DE FREQUÊNCIA (Equalizador), FORMA DE ONDA (Osciloscópio) e DUAL (Ambos).

---

### [2025-05-18 11:30] Implementação do Alterador de Frequências Terapêuticas
- **Tarefa Executada:** Integração das opções de terapia sonora (Ajuste de Pitch e Sobreposição de Frequência de Solfeggio).
- **Detalhes:**
  - **Opção A (Pitch Shifter):** Transposição de afinação em tempo real (ex: afinação padrão 440 Hz para 432 Hz ou 528 Hz) com slider e presets.
  - **Opção B (Gerador de Tons de Solfeggio):** Inserção de onda pura senoidal (`OscillatorNode`) com toggle de ativamento, presets de Solfeggio (174 Hz, 285 Hz, 396 Hz, 417 Hz, 432 Hz, 528 Hz, 639 Hz, 741 Hz, 852 Hz, 963 Hz), campo para entrada personalizada de Hz e controle de volume dedicado.

---

### [2025-05-18 12:00] Implementação da Exportação / Download de Áudio
- **Tarefa Executada:** Módulo de renderização offline e codificação WAV em `app.js`.
- **Detalhes:**
  - Utilização de `OfflineAudioContext` para processamento superveloz do áudio original combinado com as alterações de pitch e os tons terapêuticos adicionados.
  - Codificador WAV PCM de 16 bits nativo em JS puro para geração do arquivo `.wav` e download direto no navegador do usuário.
