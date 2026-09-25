/**
 * NEXUSEDIT-STUDIO-X
 * NEXUS CORE v11.0
 * AI Task Orchestrator
 *
 * Rôle :
 * - comprendre l'intention générale
 * - construire un plan de tâches
 * - gérer l'état du projet
 * - préparer l'exécution par des agents spécialisés
 *
 * Aucun secret/API key n'est stocké ici.
 */

(function () {
  'use strict';

  const VERSION = '11.0.0';

  const TASK_STATUS = Object.freeze({
    PENDING: 'pending',
    RUNNING: 'running',
    DONE: 'done',
    ERROR: 'error',
    SKIPPED: 'skipped'
  });

  const AGENTS = Object.freeze({
    planner: 'planner',
    creative: 'creative',
    coder: 'coder',
    video: 'video',
    image: 'image',
    audio: 'audio',
    voice: 'voice',
    reviewer: 'reviewer',
    exporter: 'exporter'
  });

  const INTENTS = Object.freeze({
    GENERAL: 'general',
    CODE: 'code_creation',
    VIDEO: 'video_creation',
    IMAGE: 'image_creation',
    AUDIO: 'audio_creation',
    DOCUMENT: 'document_creation',
    ANALYSIS: 'analysis',
    PROJECT: 'project_creation'
  });

  class NexusCore {

    constructor(options = {}) {
      this.version = VERSION;

      this.project = options.project || {
        id: this.createId('project'),
        name: 'Nexus Project',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.listeners = new Set();
      this.activePlan = null;

      this.agents = new Map();

      console.info(`🧠 Nexus Core ${VERSION} initialisé.`);
    }

    createId(prefix = 'nexus') {
      return `${prefix}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    }

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      this.listeners.add(listener);

      return () => this.listeners.delete(listener);
    }

    emit(event, data = {}) {
      const payload = {
        event,
        timestamp: Date.now(),
        ...data
      };

      this.listeners.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error('[NexusCore] listener error:', error);
        }
      });

      window.dispatchEvent(
        new CustomEvent(`nexus:${event}`, {
          detail: payload
        })
      );
    }

    detectIntent(prompt) {
      const text = String(prompt || '').toLowerCase();

      if (
        /vidéo|video|film|short|tiktok|youtube|montage/.test(text)
      ) {
        return INTENTS.VIDEO;
      }

      if (
        /image|photo|affiche|logo|illustration|poster/.test(text)
      ) {
        return INTENTS.IMAGE;
      }

      if (
        /musique|audio|son|sound|chanson/.test(text)
      ) {
        return INTENTS.AUDIO;
      }

      if (
        /voix|narration|doublage|parler/.test(text)
      ) {
        return INTENTS.AUDIO;
      }

      if (
        /code|application|app|site|html|javascript|python|programme|logiciel/.test(text)
      ) {
        return INTENTS.CODE;
      }

      if (
        /document|rapport|présentation|pdf|markdown/.test(text)
      ) {
        return INTENTS.DOCUMENT;
      }

      if (
        /analyse|analyser|diagnostic|examine|corrige/.test(text)
      ) {
        return INTENTS.ANALYSIS;
      }

      if (
        /projet|plateforme|système|solution complète/.test(text)
      ) {
        return INTENTS.PROJECT;
      }

      return INTENTS.GENERAL;
    }

    createTask({
      id,
      title,
      agent,
      action,
      dependsOn = [],
      input = {}
    }) {
      return {
        id: id || this.createId('task'),
        title,
        agent,
        action,
        dependsOn,
        input,
        status: TASK_STATUS.PENDING,
        output: null,
        error: null,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null
      };
    }

    buildPlan(prompt, context = {}) {

      const intent = this.detectIntent(prompt);

      const base = {
        id: this.createId('plan'),
        version: '1.0',
        coreVersion: VERSION,
        prompt: String(prompt || ''),
        intent,
        projectId: this.project.id,
        context,
        tasks: [],
        createdAt: Date.now()
      };

      switch (intent) {

        case INTENTS.VIDEO:

          base.tasks = [
            this.createTask({
              title: 'Analyser la demande vidéo',
              agent: AGENTS.planner,
              action: 'analyze_video_request'
            }),

            this.createTask({
              title: 'Créer le scénario',
              agent: AGENTS.creative,
              action: 'create_script',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Créer le storyboard',
              agent: AGENTS.creative,
              action: 'create_storyboard',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Préparer les ressources visuelles',
              agent: AGENTS.image,
              action: 'prepare_visual_assets',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Générer les séquences vidéo',
              agent: AGENTS.video,
              action: 'generate_video',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Générer narration et audio',
              agent: AGENTS.voice,
              action: 'generate_voice',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Assembler la vidéo',
              agent: AGENTS.video,
              action: 'assemble_video',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Contrôler le résultat',
              agent: AGENTS.reviewer,
              action: 'review_video',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Exporter la vidéo',
              agent: AGENTS.exporter,
              action: 'export_video',
              dependsOn: ['previous']
            })
          ];

          break;

        case INTENTS.CODE:

          base.tasks = [
            this.createTask({
              title: 'Analyser le besoin',
              agent: AGENTS.planner,
              action: 'analyze_code_request'
            }),

            this.createTask({
              title: "Construire l'architecture",
              agent: AGENTS.coder,
              action: 'design_architecture',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Générer le code',
              agent: AGENTS.coder,
              action: 'generate_code',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Tester le code',
              agent: AGENTS.reviewer,
              action: 'test_code',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Corriger les problèmes',
              agent: AGENTS.coder,
              action: 'fix_code',
              dependsOn: ['previous']
            })
          ];

          break;

        case INTENTS.IMAGE:

          base.tasks = [
            this.createTask({
              title: 'Analyser la demande',
              agent: AGENTS.planner,
              action: 'analyze_image_request'
            }),

            this.createTask({
              title: 'Construire le prompt visuel',
              agent: AGENTS.creative,
              action: 'create_image_prompt',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Générer l'image',
              agent: AGENTS.image,
              action: 'generate_image',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Contrôler l'image',
              agent: AGENTS.reviewer,
              action: 'review_image',
              dependsOn: ['previous']
            })
          ];

          break;

        case INTENTS.AUDIO:

          base.tasks = [
            this.createTask({
              title: 'Analyser la demande audio',
              agent: AGENTS.planner,
              action: 'analyze_audio_request'
            }),

            this.createTask({
              title: 'Préparer le contenu',
              agent: AGENTS.creative,
              action: 'prepare_audio_content',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Générer l'audio',
              agent: AGENTS.audio,
              action: 'generate_audio',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Contrôler le résultat',
              agent: AGENTS.reviewer,
              action: 'review_audio',
              dependsOn: ['previous']
            })
          ];

          break;

        default:

          base.tasks = [
            this.createTask({
              title: 'Analyser la demande',
              agent: AGENTS.planner,
              action: 'analyze_request'
            }),

            this.createTask({
              title: 'Produire une réponse',
              agent: AGENTS.creative,
              action: 'respond',
              dependsOn: ['previous']
            }),

            this.createTask({
              title: 'Vérifier le résultat',
              agent: AGENTS.reviewer,
              action: 'review',
              dependsOn: ['previous']
            })
          ];
      }

      this.activePlan = base;

      this.project.updatedAt = Date.now();

      this.emit('plan-created', {
        plan: base
      });

      return base;
    }

    async executePlan(plan, executor) {

      if (!plan) {
        throw new Error('Aucun plan Nexus disponible.');
      }

      if (typeof executor !== 'function') {
        throw new Error('Aucun executor Nexus fourni.');
      }

      this.activePlan = plan;

      this.emit('plan-started', { plan });

      for (let i = 0; i < plan.tasks.length; i++) {

        const task = plan.tasks[i];

        task.status = TASK_STATUS.RUNNING;
        task.startedAt = Date.now();

        this.emit('task-started', {
          plan,
          task
        });

        try {

          const output = await executor(task, {
            plan,
            project: this.project,
            taskIndex: i
          });

          task.output = output;
          task.status = TASK_STATUS.DONE;
          task.completedAt = Date.now();

          this.emit('task-completed', {
            plan,
            task
          });

        } catch (error) {

          task.status = TASK_STATUS.ERROR;
          task.error = error?.message || String(error);
          task.completedAt = Date.now();

          this.emit('task-error', {
            plan,
            task,
            error
          });

          throw error;
        }
      }

      this.emit('plan-completed', {
        plan
      });

      return plan;
    }

    getState() {
      return {
        version: VERSION,
        project: this.project,
        activePlan: this.activePlan
      };
    }
  }

  window.NexusCore = NexusCore;

  window.NexusCoreInstance = new NexusCore();

  console.info(
    `🚀 Nexus Core ${VERSION} disponible via window.NexusCoreInstance`
  );

})();
