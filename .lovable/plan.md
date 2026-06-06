## Add "cost per bedroom" slider to HMO Compliance Checker

Add a user-controlled conversion cost estimate so you can quickly cost up the works for any HMO scenario.

### Inputs panel (left column, `src/routes/hmo-compliance.tsx`)

Add a new control under the amenity settings block:

- Label: **"Conversion cost per bedroom"**
- Slider: range £5,000 → £50,000, step £1,000, default **£20,000**
- Live value display next to the label, e.g. `£20,000 / bedroom`
- Helper text: "Rough build cost per new HMO bedroom (en-suite, stud walls, fire doors, decoration). Adjust to match your spec."

State: `const [costPerBedroom, setCostPerBedroom] = useState(20000);`

### Scenario cards (Capacity scenarios section, ~line 908)

On each of the three scenario cards (Max singles / Balanced / Max doubles), add a new line under the bedroom count:

- **Est. conversion cost: £{bedroomCount × costPerBedroom}** (formatted with thousands separators)

This makes the cost reactive — moving the slider instantly updates all three cards.

### Active scenario detail (Reconfiguration section, ~line 1127)

Add a small summary line above the reconfiguration steps for the active scenario:

> Estimated build cost for this layout: **£{cost}** ({bedroomCount} bedrooms × £{costPerBedroom})

This anchors the cost next to the actual works being listed.

### Persistence

Include `costPerBedroom` in the `inputs` object saved to `hmo_analyses` (in `handleSave`) and hydrate it from `inputs.costPerBedroom` in the saved-analysis loader effect, so reopening a saved check restores your slider value.

### Out of scope (not changing)

- No changes to `analyseFloorplan` server function, system prompt, or AI model — cost is a pure client-side multiplication, not part of the AI analysis.
- No DB migration needed — `inputs` is already a JSON column.
- GDV/yield section unchanged (it uses rent, not cost).

### Technical details

- Use a native `<input type="range">` styled with Tailwind to stay consistent with the existing controls in this file (the file uses native inputs, not the shadcn Slider component).
- Format currency with `new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })`.
- Only one file changes: `src/routes/hmo-compliance.tsx`.