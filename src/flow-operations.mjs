/**
 * Product surface from public Flow documentation, NOT a promise of browser automation.
 * Live availability, regional restrictions and model choice must be probed by each adapter.
 */
export const FLOW_OPERATIONS = Object.freeze({
  'project.create': { group: 'project', changesRemote: true, credit: 'none', required: ['title'], description: 'Create an account-local Flow project' },
  'asset.upload': { group: 'assets', changesRemote: true, credit: 'none', required: ['assetId'], description: 'Upload a canonical reference, only when missing' },
  'asset.organize': { group: 'assets', changesRemote: true, credit: 'none', required: ['action', 'assetIds'], description: 'Rename or collect existing project assets' },
  'asset.export': { group: 'assets', changesRemote: false, credit: 'none', required: ['source'], description: 'Retrieve an existing media asset, not regenerate' },
  'character.create': { group: 'characters', changesRemote: true, credit: 'none', required: ['characterId'], description: 'Create project-local character from versioned bible' },
  'avatar.create': { group: 'characters', changesRemote: true, credit: 'daily-quota', required: ['prompt'], description: 'Create Flow avatar when supported in region/plan' },
  'voice.create': { group: 'characters', changesRemote: true, credit: 'daily-quota', required: ['prompt'], description: 'Create a custom voice when supported in region/plan' },
  'character.update': { group: 'characters', changesRemote: true, credit: 'none', required: ['characterId'], description: 'Modify a project-local character without changing the canonical bible' },
  'image.generate': { group: 'images', changesRemote: true, credit: 'daily-quota', required: ['prompt'], description: 'Generate still image' },
  'image.edit': { group: 'images', changesRemote: true, credit: 'daily-quota', required: ['prompt', 'source'], description: 'Edit still image and preserve prior version' },
  'image.upscale': { group: 'images', changesRemote: true, credit: 'daily-quota', required: ['source'], description: 'Upscale an existing image' },
  'video.text': { group: 'videos', changesRemote: true, credit: 'metered', required: ['prompt'], description: 'Create a video from text' },
  'video.frames': { group: 'videos', changesRemote: true, credit: 'metered', required: ['prompt', 'startFrame'], description: 'Animate one or two anchor frames' },
  'video.ingredients': { group: 'videos', changesRemote: true, credit: 'metered', required: ['prompt', 'ingredients'], description: 'Generate video with canonical ingredients' },
  'video.edit': { group: 'videos', changesRemote: true, credit: 'metered', required: ['prompt', 'source'], description: 'Video-to-video edits / refinement' },
  'video.extend': { group: 'videos', changesRemote: true, credit: 'metered', required: ['prompt', 'source'], description: 'Extend clip (requires eligible Omni capability)' },
  'video.upscale': { group: 'videos', changesRemote: true, credit: 'metered', required: ['source', 'resolution'], description: 'Upscale existing video when available' },
  'scene.export': { group: 'scenes', changesRemote: false, credit: 'none', required: ['source'], description: 'Download an existing Scenebuilder composition' },
  'scene.compose': { group: 'scenes', changesRemote: true, credit: 'none', required: ['clips'], description: 'Arrange existing clips in Scenebuilder' },
  'agent.prompt': { group: 'agent', changesRemote: true, credit: 'daily-quota', required: ['prompt'], description: 'Invoke Flow creative Agent (may generate media)' },
  'tool.create': { group: 'tools', changesRemote: true, credit: 'daily-quota', required: ['prompt'], description: 'Build a reusable Flow custom Tool' },
  'tool.run': { group: 'tools', changesRemote: true, credit: 'metered', required: ['toolId'], description: 'Run a Flow custom Tool; credit quote is provider-specific' },
  'tool.update': { group: 'tools', changesRemote: true, credit: 'daily-quota', required: ['prompt', 'toolId'], description: 'Revise existing Flow custom Tool' }
});
export const FLOW_DOCS = Object.freeze([
  'https://support.google.com/flow/answer/16353334',
  'https://support.google.com/flow/answer/16935718',
  'https://support.google.com/flow/answer/16729550',
  'https://support.google.com/flow/answer/16935308',
  'https://support.google.com/flow/answer/17104535',
  'https://support.google.com/flow/answer/17093911',
  'https://support.google.com/flow/answer/16352836'
]);
export function listFlowOperations() {
  return { provider: 'google-flow', catalogType: 'documented-capabilities-not-live-availability',
    verifiedLive: false, operations: Object.entries(FLOW_OPERATIONS).map(([id, info]) => ({ id, ...info })), sources: FLOW_DOCS };
}