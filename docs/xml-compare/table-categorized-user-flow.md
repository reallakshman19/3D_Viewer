# Table to Categorized XML user flow

This document describes the shadow-mode workflow for creating a categorized XML download from table data.

The canonical categorized graph is the working model. XML is only one export format. SourceXML and TargetXML canvas handoff remains explicit; nothing is sent automatically.

## Quick path

1. Open **Table to Categorized XML**.
2. In **Source**, click **Load PS Mapping Table 2 Sample** or paste your own table and click **Read Active Table**.
3. Go to **Fields** and review **Column Mapping Proof**.
4. Go to **Rules** and review **Coordinate Group Proof**.
5. Go to **Relationships** and review **Final Group Proof**.
6. Click **Build Preview Graph**.
7. Go to **Structure** and review **Graph Build Proof**.
8. Go to **Quality** and review blockers or warnings.
9. Go to **Output** and click **Download Categorized XML**.

## Load PS Mapping Table 2 Sample

Use **Load PS Mapping Table 2 Sample** when you want a ready-made example source table. The sample is preset content only; it does not make the global UI PS-specific.

After loading, the **Rows** preview should show imported rows. The **Current / Next** strip should show:

- Current: Source — Load or paste table.
- Next: Fields — Confirm column mapping.

## Fields proof

The **Fields** step shows **Column Mapping Proof**. It explains how a source column value becomes a common group key.

Example:

| Source Column | Table Value | Common Group Key | Meaning |
|---|---|---|---|
| PS NO | PS-XYZ.1 | PS-XYZ | PS-XYZ.1 belongs under PS-XYZ |

Review this step before moving to Rules.

## Rules proof

The **Rules** step shows **Coordinate Group Proof**. It explains how coordinate/grouping logic creates a coordinate group from table values.

Use this to confirm that rows with nearby X/Y/Z values are grouped correctly before final grouping.

## Final Group proof

The **Relationships** step shows **Final Group Proof**.

A **Final Group** is the parent grouping key created from:

```text
Common Group Key + Coordinate Group
```

The Final Group becomes a graph parent. Child items and details/values are placed below it after graph build.

When final grouping is available but the graph is not built, the preview shows:

```text
Final Group is ready.
Next step: Build Graph.
```

Click **Build Preview Graph** to continue.

## Graph not built

If you see:

```text
Graph not built yet.
```

it means table rows and grouping proof may exist, but graph nodes have not been created yet. Click **Build Preview Graph**.

The graph build creates:

```text
Document Root
  Model Split
    Final Groups
      Child Items
        Details / Values
```

## Build graph

Use **Build Preview Graph** after checking Fields, Rules, and Relationships.

The action uses the existing source tables and current profile. It parses unparsed tables if required, builds the graph with the existing graph builder, runs validation, and prepares export artifacts.

A successful graph build navigates to **Structure / Graph View** and shows:

```text
Graph built successfully.
```

Next, click **Check Quality** or **Go to Output**.

## Quality check

Use **Quality** to review blockers and warnings.

- A blocker prevents export/download.
- A warning should be reviewed, but may not block export.
- If export is blocked, return to Source, Fields, Rules, Relationships, or Structure as needed.

## Download Categorized XML

Go to **Output** after the graph is built and validation/export are ready.

When ready, the Output step shows:

```text
Categorized XML ready.
```

Click **Download Categorized XML**.

Other available artifacts are:

- **Download Graph JSON**
- **Download Recipe JSON**
- **Download Diagnostics JSON**
- **Download Audit JSON**

## Troubleshooting

### Source pending

The source table has not been loaded or parsed. Use **Load PS Mapping Table 2 Sample**, paste table text, or import a text/CSV file, then click **Read Active Table**.

### Fields missing columns

The Fields proof depends on parsed table headers. Return to Source, confirm the table has a header row, and click **Read Active Table** again.

### Graph not built yet

The grouping proof exists, but graph nodes do not. Click **Build Preview Graph** from Final Group, Graph View, or Output.

### Export blocked

Open **Quality** and review the blocker. Blockers must be resolved before export artifacts are ready.

### Download disabled

Downloads are hidden or blocked until export is ready. Build the preview graph first, then check Quality. The Output step will show **Categorized XML ready** when downloads are available.

## Guardrails

- No automatic SourceXML / TargetXML canvas mutation.
- XML remains one export format.
- One XML document root is used.
- Logical splits are child partitions below the root.
- Graph Compare Canvas Preview remains a generic shadow preview.
- PS Mapping Table 2 wording is preset/sample content only.
