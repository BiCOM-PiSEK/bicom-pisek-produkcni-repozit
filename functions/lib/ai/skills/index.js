import { buildTextContentMessages } from './text-content.js';
import { buildChatbotMessages } from './chatbot.js';
import { buildVisualContentPrompt } from './visual-content.js';

/**
 * Minimal skill registry for AI Studio orchestration.
 * Keeping this explicit avoids prompt drift in endpoints.
 */
const SKILLS = {
  'text-content': buildTextContentMessages,
  chatbot: buildChatbotMessages,
  'visual-content': buildVisualContentPrompt,
};

/**
 * Resolves skill builder by name.
 * @param {string} skillName
 * @returns {Function}
 */
export function getSkill(skillName) {
  const skill = SKILLS[skillName];
  if (!skill) {
    throw new Error(`Unknown AI skill: ${skillName}`);
  }
  return skill;
}
