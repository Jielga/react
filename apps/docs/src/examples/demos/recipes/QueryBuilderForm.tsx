import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Select,
  Text,
  TextInput,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { z } from "zod";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
  type TMDataGridEditorArgs,
  type TMDataGridEditorComponent,
  type TMDataGridRowValidators,
} from "@jielga/tmdatagrid";

const FIELDS = ["title", "status", "hired"] as const;
type QueryField = (typeof FIELDS)[number];

type QueryCondition = {
  /** Negative while unsaved - the server mints the real id. */
  id: number;
  field: QueryField;
  operator: string;
  value: string;
};

/** Server-derived, per condition. Never part of the form's value. */
type Availability = {
  hours: number | null;
  calcStatus: "idle" | "pending" | "error";
  /** The date range these hours were calculated for. */
  forRange: string;
};

/** What the grid renders: a condition joined with its last calculation. */
type ConditionRow = QueryCondition & Availability;

const IDLE: Availability = { hours: null, calcStatus: "idle", forRange: "" };

const rangeKey = (from: string, to: string) => `${from}|${to}`;

const OPERATORS: Record<QueryField, ReadonlyArray<string>> = {
  title: ["contains", "equals", "starts with"],
  status: ["equals", "does not equal"],
  hired: ["before", "after", "on"],
};

const STATUSES = ["Active", "On leave", "Terminated"];

const INITIAL_CONDITIONS: Array<QueryCondition> = [
  { id: 1, field: "title", operator: "contains", value: "engineer" },
  { id: 2, field: "status", operator: "equals", value: "Active" },
];

/** Stands in for the server: one condition plus the page's date range in. */
const fetchAvailabilityHours = (input: {
  condition: QueryCondition;
  from: string;
  to: string;
}) =>
  new Promise<number>((resolve) => {
    setTimeout(() => {
      const span = input.from && input.to ? 160 : 40;
      resolve(span + input.condition.value.trim().length * 3);
    }, 700);
  });

const FORM_DEFAULTS = {
  from: "",
  to: "",
  title: "",
  conditions: INITIAL_CONDITIONS,
};

const useQueryForm = (onSubmitted: (summary: string) => void) =>
  useForm({
    defaultValues: FORM_DEFAULTS,
    onSubmit: ({ value }) =>
      onSubmitted(
        `Searching ${value.from || "…"} to ${value.to || "…"}` +
          (value.title ? ` for "${value.title}"` : "") +
          ` with ${value.conditions.length} condition(s)`,
      ),
  });

type QueryFormApi = ReturnType<typeof useQueryForm>;

/**
 * Carries the form instance, which `useForm` creates once. A context whose
 * value never changes re-renders no consumer - what re-renders is the store
 * subscription a consumer opens, over the slice it selects and nothing else.
 * So no form value is ever passed down, only the handle to read them from.
 */
const QueryFormContext = createContext<QueryFormApi | null>(null);

/**
 * The date range as one key. Typing in Title re-runs this selector and changes
 * nothing, so it re-renders nothing; picking a date re-renders the mounted
 * availability cells and only those.
 */
const useRange = () => {
  // Non-null: the cells that call this only ever mount under the provider.
  const form = useContext(QueryFormContext)!;
  return useSelector(form.store, (state) =>
    rangeKey(state.values.from, state.values.to),
  );
};

/**
 * Every editor reads its live values from the row's form store, which each
 * editor receives - `field.state.value` alone is a render-time read, so a
 * controlled input bound to it goes stale after its own handleChange.
 */
const useDraft = (form: TMDataGridEditorArgs["form"]) =>
  useSelector(form.store, (state) => state.values as QueryCondition);

/**
 * Picking a field changes what the other two columns mean, so this editor
 * also resets them - through the row's own form.
 */
const FieldEditor: TMDataGridEditorComponent = ({ field, form, size }) => {
  const draft = useDraft(form);
  return (
    <Select
      size={size}
      w="100%"
      data={[...FIELDS]}
      comboboxProps={{ withinPortal: false }}
      aria-label="Field"
      value={draft.field}
      onChange={(next) => {
        if (next === null) return;
        field.handleChange(next);
        form.setFieldValue("operator", OPERATORS[next as QueryField][0]);
        form.setFieldValue("value", "");
      }}
    />
  );
};

/** Offers the operators of the field being picked, not the committed one. */
const OperatorEditor: TMDataGridEditorComponent = ({ field, form, size }) => {
  const draft = useDraft(form);
  return (
    <Select
      size={size}
      w="100%"
      data={[...OPERATORS[draft.field]]}
      comboboxProps={{ withinPortal: false }}
      aria-label="Operator"
      value={draft.operator}
      onChange={(next) => next !== null && field.handleChange(next)}
    />
  );
};

/** A text box, a select or a date input - whichever the draft field wants. */
const ValueEditor: TMDataGridEditorComponent = ({ field, form, size }) => {
  const draft = useDraft(form);
  if (draft.field === "status") {
    return (
      <Select
        size={size}
        w="100%"
        data={STATUSES}
        comboboxProps={{ withinPortal: false }}
        aria-label="Value"
        value={draft.value}
        onChange={(next) => next !== null && field.handleChange(next)}
      />
    );
  }
  return (
    <TextInput
      size={size}
      w="100%"
      type={draft.field === "hired" ? "date" : "text"}
      aria-label="Value"
      value={draft.value}
      onChange={(event) => field.handleChange(event.currentTarget.value)}
    />
  );
};

/**
 * The one place that needs a live form value while rendering, so the one place
 * that subscribes. The subscription sits in the leaf on purpose: no column is
 * rebuilt, no row object is replaced and nothing above this cell re-renders
 * when the range changes.
 */
function AvailabilityCell({
  rowId,
  availability,
  onCalculate,
}: {
  rowId: string;
  availability: Availability;
  onCalculate: (rowId: string) => void;
}) {
  const range = useRange();
  const stale = availability.hours !== null && availability.forRange !== range;
  return (
    <Group gap={4} justify="flex-end" wrap="nowrap" w="100%">
      <Text size="sm" c={stale ? "dimmed" : undefined}>
        {availability.hours ?? "-"}
      </Text>
      <ActionIcon
        size="sm"
        variant="subtle"
        aria-label={
          stale
            ? "Recalculate for the current date range"
            : "Calculate availability hours"
        }
        loading={availability.calcStatus === "pending"}
        color={
          availability.calcStatus === "error"
            ? "red"
            : stale
              ? "yellow"
              : undefined
        }
        onClick={() => onCalculate(rowId)}
      >
        <IconRefresh size={14} />
      </ActionIcon>
    </Group>
  );
}

const columnHelper = createTMDataGridColumnHelper<ConditionRow>();

/**
 * Built per grid instead of at module scope, because the availability cell
 * needs the page's calculate action and the grid's table meta is the library's
 * own closed type. `onCalculate` never changes identity, so neither does this.
 */
const createColumns = (onCalculate: (rowId: string) => void) =>
  columnHelper.columns([
    columnHelper.accessor("field", {
      header: "Field",
      minSize: 120,
      meta: { edit: { editor: FieldEditor } },
    }),
    columnHelper.accessor("operator", {
      header: "Operator",
      minSize: 140,
      meta: { edit: { editor: OperatorEditor } },
    }),
    columnHelper.accessor("value", {
      header: "Value",
      minSize: 160,
      meta: { edit: { editor: ValueEditor } },
    }),
    columnHelper.accessor("hours", {
      header: "Availability (h)",
      minSize: 150,
      // An accessor, so the column sorts and filters like any other. Editing
      // is off: without that, clicking the button opens a row draft under it.
      meta: { type: "number", align: "right", edit: { enabled: false } },
      cell: ({ row }) => (
        <AvailabilityCell
          rowId={row.id}
          availability={row.original}
          onCalculate={onCalculate}
        />
      ),
    }),
  ]);

/** The row's own rule: whatever the operator, it compares against something. */
const rowValidators = {
  onSubmit: z
    .object({ value: z.string() })
    .refine((condition) => condition.value.trim().length > 0, {
      message: "The condition needs a value",
      path: ["value"],
    }),
} satisfies TMDataGridRowValidators;

/**
 * The grid packaged as a form field: rows in through `value`, the next array
 * out through `onChange`. The component owns nothing - every change is the
 * form's to keep. It knows nothing of the page's form either: the calculation
 * reaches it as one stable callback.
 */
function ConditionsGrid({
  value,
  onChange,
  onOpenDraftChange,
  availability,
  onCalculate,
}: {
  value: Array<QueryCondition>;
  onChange: (next: Array<QueryCondition>) => void;
  onOpenDraftChange: (open: boolean) => void;
  availability: Record<number, Availability>;
  onCalculate: (rowId: string) => void;
}) {
  const columns = useMemo(() => createColumns(onCalculate), [onCalculate]);

  // What the grid shows is the form's value joined with the results. The hours
  // belong to the server, so they stay out of the value the form submits.
  const rows = useMemo(
    () =>
      value.map((condition) => ({
        ...condition,
        ...(availability[condition.id] ?? IDLE),
      })),
    [value, availability],
  );

  const grid = useTMDataGrid({
    data: rows,
    columns,
    getRowId: (row) => String(row.id),
    editing: {
      mode: "row",
      rowValidators,
      // Map by row id, never by index - a sort or a delete moves the index,
      // and the draft is keyed by id.
      //
      // `value` is the whole row, joined fields and all, so the three edited
      // fields are named rather than spread: `hours` must not travel back into
      // the form. `changes` carries the same edits as a per-field diff.
      onCommit: ({ rowId, value: row }) =>
        onChange(
          value.map((condition) =>
            String(condition.id) === rowId
              ? {
                  id: condition.id,
                  field: row.field,
                  operator: row.operator,
                  value: row.value,
                }
              : condition,
          ),
        ),
      // New rows count down from -1; the server mints real ids on save.
      // Math.min(0, ...) so an emptied grid starts at -1, not -Infinity.
      onRowAdd: ({ value: row }) =>
        onChange([
          ...value,
          {
            id: Math.min(0, ...value.map((c) => c.id)) - 1,
            field: row.field,
            operator: row.operator,
            value: row.value,
          },
        ]),
      onRowDelete: ({ rowId }) =>
        onChange(value.filter((condition) => String(condition.id) !== rowId)),
      newRowDefaults: (): ConditionRow => ({
        id: 0,
        field: "title",
        operator: "contains",
        value: "",
        ...IDLE,
      }),
    },
    enableRowSelection: false,
    enableGrouping: false,
  });

  // The one thing the form needs to know that only the grid does: whether a
  // condition is mid-edit. The store publishes no values, just the fact.
  const hasOpenDraft = useSelector(
    grid.edit.store,
    (state) => state.openRowIds.length > 0,
  );
  useEffect(() => {
    onOpenDraftChange(hasOpenDraft);
  }, [hasOpenDraft, onOpenDraftChange]);

  return (
    <TMDataGrid {...grid} size="sm" style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => grid.edit.addRow()}
        >
          Add condition
        </Button>
      </TMDataGrid.Toolbar>
      <TMDataGrid.Table<ConditionRow> />
    </TMDataGrid>
  );
}

export function QueryBuilderForm() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [hasOpenDraft, setHasOpenDraft] = useState(false);
  // Kept here rather than in the button: the body is virtualized, so a pending
  // row that scrolls out unmounts and would take its own state with it.
  const [availability, setAvailability] = useState<
    Record<number, Availability>
  >({});

  const form = useQueryForm(setSubmitted);

  /**
   * Stable for the life of the page. It reads the date range off the store at
   * click time instead of closing over it, so typing in the header re-renders
   * no cell and the request still sees what is in the boxes now.
   */
  const calculate = useCallback(
    async (rowId: string) => {
      const id = Number(rowId);
      const { from, to, conditions } = form.store.state.values;
      const condition = conditions.find((c) => c.id === id);
      if (!condition) return;

      setAvailability((current) => ({
        ...current,
        [id]: { ...(current[id] ?? IDLE), calcStatus: "pending" },
      }));
      try {
        const hours = await fetchAvailabilityHours({ condition, from, to });
        // Stamped with the range it was calculated for, so the cell can tell
        // that a later change to From or To left it stale.
        setAvailability((current) => ({
          ...current,
          [id]: { hours, calcStatus: "idle", forRange: rangeKey(from, to) },
        }));
      } catch {
        setAvailability((current) => ({
          ...current,
          [id]: { ...(current[id] ?? IDLE), calcStatus: "error" },
        }));
      }
    },
    [form],
  );

  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const conditionsError = useSelector(form.store, (state) =>
    state.fieldMeta.conditions?.errors.find(
      (error): error is string => typeof error === "string",
    ),
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: 1,
        minHeight: 0,
      }}
    >
      <Group gap="xs" align="flex-end">
        <form.Field name="from">
          {(field) => (
            <TextInput
              label="From"
              type="date"
              size="xs"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
            />
          )}
        </form.Field>
        <form.Field name="to">
          {(field) => (
            <TextInput
              label="To"
              type="date"
              size="xs"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
            />
          )}
        </form.Field>
        <form.Field name="title">
          {(field) => (
            <TextInput
              label="Title"
              placeholder="Any title"
              size="xs"
              style={{ flex: 1 }}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
            />
          )}
        </form.Field>
      </Group>

      {/* The provider reaches exactly as far as the subtree that subscribes. */}
      <QueryFormContext.Provider value={form}>
        <form.Field
          name="conditions"
          validators={{
            // Collection rules live here: they need the whole array, which no
            // single row can see. Runs per approved row, never per keystroke.
            onChange: ({ value }) => {
              if (value.length === 0) return "Add at least one condition";
              const pairs = value.map((c) => `${c.field}:${c.operator}`);
              return pairs.some((pair, i) => pairs.indexOf(pair) !== i)
                ? "Two conditions repeat the same field and operator"
                : undefined;
            },
          }}
        >
          {(field) => (
            <ConditionsGrid
              value={field.state.value}
              onChange={field.handleChange}
              onOpenDraftChange={setHasOpenDraft}
              availability={availability}
              onCalculate={calculate}
            />
          )}
        </form.Field>
      </QueryFormContext.Provider>

      {conditionsError && (
        <Alert color="red" variant="light" p="xs">
          {conditionsError}
        </Alert>
      )}

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {submitted ?? "Nothing searched yet"}
        </Text>
        <Button
          type="submit"
          size="compact-sm"
          disabled={!canSubmit || hasOpenDraft}
        >
          {hasOpenDraft ? "Finish the open condition" : "Search"}
        </Button>
      </Group>
    </form>
  );
}
