'use client';

import { useId, useState, type FormEvent } from 'react';
import {
  REEL_CAMERAS,
  REEL_SHOTS,
  SCENE_ACTION_MAX_CHARS,
  SCENE_MAX_SECONDS,
  SCENE_MIN_SECONDS,
  SCENE_SETTING_MAX_CHARS,
  SCENE_TEXT_MAX_CHARS,
  SCENE_VOICEOVER_MAX_CHARS,
  type ReelCamera,
  type ReelCharacter,
  type ReelScene,
  type ReelShot,
  type UpdateReelScene,
} from '@marketpilot/contracts';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FieldGroup,
  Input,
  Select,
  Switch,
  Textarea,
} from '@marketpilot/ui';

const SECONDS = Array.from(
  { length: SCENE_MAX_SECONDS - SCENE_MIN_SECONDS + 1 },
  (_, i) => SCENE_MIN_SECONDS + i,
);

interface SceneFormProps {
  scene: ReelScene;
  cast: ReelCharacter[];
  saving: boolean;
  error: string | null;
  onSave: (changes: UpdateReelScene) => void;
  onCancel: () => void;
}

export function SceneForm({ scene, cast, saving, error, onSave, onCancel }: SceneFormProps) {
  const productLabelId = useId();
  const [durationSeconds, setDuration] = useState(scene.durationSeconds);
  const [shot, setShot] = useState<ReelShot>(scene.shot);
  const [camera, setCamera] = useState<ReelCamera>(scene.camera);
  const [setting, setSetting] = useState(scene.setting);
  const [action, setAction] = useState(scene.action);
  const [characterIds, setCharacterIds] = useState(scene.characterIds);
  const [showsProduct, setShowsProduct] = useState(scene.showsProduct);
  const [onScreenText, setOnScreenText] = useState(scene.onScreenText ?? '');
  const [voiceover, setVoiceover] = useState(scene.voiceover ?? '');

  const settingProblem = setting.trim() ? undefined : 'Describe where this scene happens';
  const actionProblem = action.trim() ? undefined : 'Describe what happens';

  function toggle(id: string, on: boolean) {
    setCharacterIds((current) => (on ? [...current, id] : current.filter((c) => c !== id)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (settingProblem || actionProblem) return;
    onSave({
      durationSeconds,
      shot,
      camera,
      setting: setting.trim(),
      action: action.trim(),
      characterIds,
      showsProduct,
      onScreenText: onScreenText.trim() || null,
      voiceover: voiceover.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Length">
          <Select
            value={String(durationSeconds)}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {SECONDS.map((s) => (
              <option key={s} value={s}>
                {s} seconds
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Shot">
          <Select value={shot} onChange={(e) => setShot(e.target.value as ReelShot)}>
            {REEL_SHOTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Camera">
          <Select value={camera} onChange={(e) => setCamera(e.target.value as ReelCamera)}>
            {REEL_CAMERAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Where"
        helper="The place, the light and what is around, as one photo would show it."
        error={settingProblem}
      >
        <Textarea
          value={setting}
          maxLength={SCENE_SETTING_MAX_CHARS}
          rows={2}
          onChange={(e) => setSetting(e.target.value)}
        />
      </Field>

      <Field
        label="What happens"
        helper="One simple movement that fits in a few seconds."
        error={actionProblem}
      >
        <Textarea
          value={action}
          maxLength={SCENE_ACTION_MAX_CHARS}
          rows={2}
          onChange={(e) => setAction(e.target.value)}
        />
      </Field>

      {cast.length > 0 ? (
        <FieldGroup legend="Who is in it">
          <div className="flex flex-wrap gap-4">
            {cast.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-body text-ink">
                <Checkbox
                  checked={characterIds.includes(c.id)}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </FieldGroup>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <span id={productLabelId} className="text-label text-ink">
          Product visible
        </span>
        <Switch
          aria-labelledby={productLabelId}
          checked={showsProduct}
          onCheckedChange={setShowsProduct}
        />
      </div>

      <Field label="On-screen text" optional helper="A few words shown over this scene.">
        <Input
          value={onScreenText}
          maxLength={SCENE_TEXT_MAX_CHARS}
          onChange={(e) => setOnScreenText(e.target.value)}
        />
      </Field>

      <Field label="Voiceover" optional helper="Kept for when voiceover is added.">
        <Textarea
          value={voiceover}
          maxLength={SCENE_VOICEOVER_MAX_CHARS}
          rows={2}
          onChange={(e) => setVoiceover(e.target.value)}
        />
      </Field>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          Save scene
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
