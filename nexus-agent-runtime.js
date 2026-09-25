/**
 * NEXUSEDIT-STUDIO-X
 * NEXUS AGENT RUNTIME v1.0
 *
 * Exécute les tâches créées par Nexus Core
 * avec des agents spécialisés.
 */

(function () {
  'use strict';

  const VERSION = '1.0.0';

  const AGENT_INSTRUCTIONS = {

    planner: `
Tu es le Planner Agent de NexusEdit-Studio-X.

Ton rôle :
- comprendre la demande ;
- identifier les contraintes ;
- structurer les informations ;
- produire une sortie exploitable par les agents suivants.

Réponds de manière structurée.
`,

    creative: `
Tu es le Creative Agent de NexusEdit-Studio-X.

Ton rôle :
- scénario ;
- storyboard ;
- concepts créatifs ;
- prompts ;
- narration ;
- direction artistique.

Produis des éléments précis et directement exploitables.
`,

    coder: `
Tu es le Coder Agent de NexusEdit-Studio-X.

Ton rôle :
- architecture ;
- génération de code ;
- correction ;
- tests ;
- diagnostic.

Ne modifie jamais arbitrairement une partie non demandée du projet.
`,

    video: `
Tu es le Video Agent de NexusEdit-Studio-X.

Ton rôle :
- planification vidéo ;
- scènes ;
- plans ;
- mouvements caméra ;
- génération et assemblage vidéo ;
- paramètres techniques.

`,

    image: `
Tu es le Image Agent de NexusEdit-Studio-X.

Ton rôle :
- prompts visuels ;
- direction artistique ;
- génération d'images ;
- préparation des ressources visuelles.
`,

    audio: `
Tu es le Audio Agent de NexusEdit-Studio-X.

Ton rôle :
- musique ;
- effets sonores ;
- mixage ;
- préparation audio.
`,

    voice: `
Tu es le Voice Agent de NexusEdit-Studio-X.

Ton rôle :
- narration ;
- voix ;
- doublage ;
- synchronisation vocale.
`,

    reviewer: `
Tu es le Reviewer Agent de NexusEdit-Studio-X.

Ton rôle :
- contrôler les résultats ;
- détecter les erreurs ;
- vérifier les contraintes ;
- demander des corrections si nécessaire.

Ne valide pas un résultat qui ne respecte pas les exigences.
`,

    exporter: `
Tu es le Exporter Agent de NexusEdit-Studio-X.

Ton rôle :
- préparer les fichiers finaux ;
- vérifier les formats ;
- vérifier les métadonnées ;
- préparer l'export.
`
  };

  class NexusAgentRuntime {

    constructor(options = {}) {

      this.version = VERSION;

      this.core =
        options.core ||
        window.NexusCoreInstance;

      this.gateway =
        options.gateway ||
        window.NexusAIGatewayInstance;

      this.agents =
        new Map();

      this.registerDefaultAgents();

      console.info(
        `🤖 Nexus Agent Runtime ${VERSION} initialisé.`
      );
    }

    registerAgent(name, config = {}) {

      this.agents.set(
        name,
        {
          name,
          instruction:
            config.instruction ||
            '',
          provider:
            config.provider ||
            'gemini',
          model:
            config.model ||
            null
        }
      );

      return this.agents.get(name);
    }

    registerDefaultAgents() {

      Object.entries(
        AGENT_INSTRUCTIONS
      ).forEach(
        ([name, instruction]) => {

          this.registerAgent(
            name,
            {
              instruction
            }
          );

        }
      );
    }

    getAgent(name) {

      const agent =
        this.agents.get(name);

      if (!agent) {

        throw new Error(
          `Agent Nexus inconnu : ${name}`
        );
      }

      return agent;
    }

    buildPrompt(task, plan, project) {

      const agent =
        this.getAgent(task.agent);

      return `
${agent.instruction}

CONTEXTE NEXUS
===============

Projet :
${JSON.stringify(project, null, 2)}

Plan :
${JSON.stringify(plan, null, 2)}

TÂCHE ACTUELLE
===============

ID :
${task.id}

Action :
${task.action}

Titre :
${task.title}

Entrée :
${JSON.stringify(task.input || {}, null, 2)}

OBJECTIF
===============

Exécute cette tâche et produis
un résultat structuré qui pourra être
utilisé par la tâche suivante.

Ne prétends pas avoir exécuté une
action externe si aucun outil ne t'a
réellement été fourni.
`;
    }

    async executeTask(task, context = {}) {

      const {
        plan,
        project,
        taskIndex
      } = context;

      const agent =
        this.getAgent(task.agent);

      const prompt =
        this.buildPrompt(
          task,
          plan,
          project
        );

      const result =
        await this.gateway.generate({

          provider:
            agent.provider,

          model:
            agent.model,

          prompt,

          system:
            agent.instruction,

          task: task.action,

          agent: agent.name,

          context: {
            planId: plan?.id,
            projectId: project?.id,
            taskIndex
          },

          responseFormat: 'text',

          temperature: 0.7,

          maxTokens: 4000

        });

      return result;
    }

    async executePlan(plan) {

      if (!plan) {

        throw new Error(
          'NexusAgentRuntime : aucun plan.'
        );
      }

      if (!this.core) {

        throw new Error(
          'NexusAgentRuntime : Nexus Core absent.'
        );
      }

      if (!this.gateway) {

        throw new Error(
          'NexusAgentRuntime : Gateway absente.'
        );
      }

      return this.core.executePlan(
        plan,
        async (task, context) => {

          const result =
            await this.executeTask(
              task,
              context
            );

          return result;

        }
      );
    }

    async run(prompt, context = {}) {

      const plan =
        this.core.buildPlan(
          prompt,
          context
        );

      return this.executePlan(
        plan
      );
    }

    listAgents() {

      return Array.from(
        this.agents.values()
      ).map(agent => ({
        name: agent.name,
        provider: agent.provider,
        model: agent.model
      }));
    }
  }

  window.NexusAgentRuntime =
    NexusAgentRuntime;

  window.NexusAgentRuntimeInstance =
    new NexusAgentRuntime();

  console.info(
    `🚀 Nexus Agent Runtime ${VERSION} disponible.`
  );

})();
