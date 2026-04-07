/**
 * Observation noise reduction tests (US3)
 * Tests that the agent-workflow mode correctly:
 * - Removes discovery observation type
 * - Adds mistake observation type
 * - Validates observation types against mode
 */

import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

// Read the mode file directly to validate its structure
const MODE_PATH = path.join(process.cwd(), 'plugin/modes/agent-workflow.json');

describe('US3: agent-workflow mode structure', () => {
  it('mode file exists', () => {
    expect(fs.existsSync(MODE_PATH)).toBe(true);
  });

  it('discovery is NOT in observation_types', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const typeIds = mode.observation_types.map((t: { id: string }) => t.id);
    expect(typeIds).not.toContain('discovery');
  });

  it('mistake IS in observation_types', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const typeIds = mode.observation_types.map((t: { id: string }) => t.id);
    expect(typeIds).toContain('mistake');
  });

  it('mistake type has correct structure', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const mistakeType = mode.observation_types.find((t: { id: string }) => t.id === 'mistake');
    expect(mistakeType).toBeDefined();
    expect(mistakeType.label).toBe('Mistake');
    expect(mistakeType.description).toBeDefined();
    expect(mistakeType.description.length).toBeGreaterThan(0);
  });

  it('retains bugfix, feature, refactor, change, decision types', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const typeIds = mode.observation_types.map((t: { id: string }) => t.id);
    expect(typeIds).toContain('bugfix');
    expect(typeIds).toContain('feature');
    expect(typeIds).toContain('refactor');
    expect(typeIds).toContain('change');
    expect(typeIds).toContain('decision');
  });

  it('has final-decision and mistake-pattern concepts', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const conceptIds = mode.observation_concepts.map((c: { id: string }) => c.id);
    expect(conceptIds).toContain('final-decision');
    expect(conceptIds).toContain('mistake-pattern');
  });
});

describe('US3: Prompt directives', () => {
  it('summary_instruction references new XML fields', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const instruction = mode.prompts.summary_instruction;
    expect(instruction).toContain('decision_log');
    expect(instruction).toContain('constraints_log');
    expect(instruction).toContain('mistakes');
    expect(instruction).toContain('gotchas');
  });

  it('summary_instruction says to omit empty fields', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const instruction = mode.prompts.summary_instruction.toLowerCase();
    expect(instruction).toContain('omit');
  });

  it('recording_focus mentions exact file paths', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const focus = mode.prompts.recording_focus;
    expect(focus).toContain('exact');
    expect(focus).toContain('file path');
  });

  it('skip_guidance excludes routine file reads', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const skip = mode.prompts.skip_guidance;
    expect(skip).toContain('file');
    // Should mention not logging routine exploration
    expect(skip.toLowerCase()).toMatch(/routine|directory|listing|file read/);
  });

  it('type_guidance does NOT include discovery', () => {
    const mode = JSON.parse(fs.readFileSync(MODE_PATH, 'utf-8'));
    const typeGuidance = mode.prompts.type_guidance;
    expect(typeGuidance).not.toContain('discovery:');
    expect(typeGuidance).toContain('mistake:');
  });
});
