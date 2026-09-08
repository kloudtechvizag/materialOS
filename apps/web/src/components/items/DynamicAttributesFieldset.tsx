import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AttributeSchemaEntry {
  name: string;
  unit?: string | null;
}

/** Renders Item.attributes fields from Category.parameter_schema
 * (ADR-003) -- the schema was fetched by the frontend since Slice 1 but
 * never rendered until now (see ADR-010). Advisory only, per ADR-003:
 * no client-side requiredness, just a convenient input per declared
 * attribute so Building Materials categories (grade, diameter, heat
 * number, ...) and future profiles' categories (size, color, strength,
 * ...) get the same free-form editor without per-category custom code. */
export function DynamicAttributesFieldset({
  schema,
  value,
  onChange,
}: {
  schema: AttributeSchemaEntry[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  if (schema.length === 0) return null;

  return (
    <div className="col-span-2 space-y-1.5 sm:col-span-3">
      <Label className="text-muted-foreground">Attributes</Label>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {schema.map((attr) => (
          <div key={attr.name} className="space-y-1.5">
            <Label className="text-xs font-normal">
              {attr.name}
              {attr.unit ? ` (${attr.unit})` : ""}
            </Label>
            <Input
              value={value[attr.name] ?? ""}
              onChange={(e) => onChange({ ...value, [attr.name]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
