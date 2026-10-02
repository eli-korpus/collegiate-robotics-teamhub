import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { Button, Card, FieldEditor, FormRenderer, Segmented, emptyValues, toast, type FieldDef } from '@teamhub/ui';
import { friendlyError, useRows, useSupabase } from '@teamhub/sdk';
import type { Kind, Template } from './stats';

export function Forms({ templates, season }: { templates: Template[]; season: string }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('match');
  const t = templates.find((x) => x.kind === kind);
  const [fields, setFields] = useState<FieldDef[]>(t?.fields ?? []);
  useEffect(() => setFields(t?.fields ?? []), [t?.id, kind, t?.fields]);
  const prev = useRows<Template>(['scouting', 'templates', 'prev', kind, season], (s) => s.from('sct_templates').select('*').eq('kind', kind).neq('season', season).order('season', { ascending: false }).limit(1));
  return (
    <div className="space-y-4">
      <Segmented value={kind} onChange={setKind} options={[{ value: 'match', label: 'Match form' }, { value: 'pit', label: 'Pit form' }]} />
      <p className="text-[13px] text-muted">
        Build this season's {kind} form ({season}). Use sections like “Auto”, “TeleOp”, “Endgame”. Numbers, counters, ratings, timers and yes/no fields
        power the insights and pick score; text fields become notes. Changing the form later keeps old entries readable.
        {t && <> Current version: {t.version}.</>}
      </p>
      {!fields.length && prev.data?.[0] && (
        <Button size="sm" icon={<Copy className="size-4" />} onClick={() => setFields(prev.data![0].fields)}>
          Copy last season's {kind} form ({prev.data[0].season})
        </Button>
      )}
      <FieldEditor fields={fields} onChange={setFields} />
      <Button
        variant="primary"
        onClick={async () => {
          const clean = fields.filter((f) => f.label.trim());
          const res = t ? await sb.from('sct_templates').update({ fields: clean }).eq('id', t.id) : await sb.from('sct_templates').insert({ kind, season, fields: clean });
          if (res.error) return toast.error(friendlyError(res.error));
          toast.success('Form saved');
          qc.invalidateQueries({ queryKey: ['scouting'] });
        }}
      >
        Save form
      </Button>
      {fields.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-faint">Preview</p>
          <FormRenderer fields={fields} values={emptyValues(fields)} onChange={() => {}} />
        </Card>
      )}
    </div>
  );
}
