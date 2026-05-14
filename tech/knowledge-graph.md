# Knowledge Graph

## Routes

`ConceptLinksController` is mounted at `/api/concept-links`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/concept-links/knowledge-graph` | Load graph nodes/links |
| `POST` | `/api/concept-links` | Create concept link |
| `DELETE` | `/api/concept-links/{linkId}` | Delete concept link |

Concept link generation is provided by `IAiService` and application commands in `ConceptLinks/ConceptLinkCommands.cs`.

## Graph Builder

`GetKnowledgeGraphQueryHandler` loads all of the user's documents, videos, notes, quizzes, and glossary terms in parallel, then builds a node/edge graph in memory. Nodes for the same concept (normalised title) are merged and their weight is incremented on each collision. Edges are deduplicated by directed pair and label.

```csharp
// ConceptLinkCommands.cs — node merge and deduplication helpers
void AddNode(NodeDto node)
{
    if (nodes.TryGetValue(node.Id, out var existing))
    {
        // merge: keep higher weight, carry over description
        nodes[node.Id] = existing with {
            Weight      = Math.Max(existing.Weight, node.Weight) + 1,
            Description = existing.Description ?? node.Description,
        };
        return;
    }
    nodes[node.Id] = node;
}

// Normalise before deduplication: treat "Machine Learning" and "machine learning" as the same node
string AddConcept(string term, int weight = 1, string? description = null)
{
    var title      = CleanTitle(term);
    var normalized = NormalizeConcept(title);
    var id         = $"concept:{normalized}";
    knownConcepts[title] = id;
    AddNode(new NodeDto(id, "concept", title, "Shared concept",
        $"/glossary?search={Uri.EscapeDataString(title)}", weight, description));
    return id;
}

// Edge pair is always sorted so A→B and B→A map to the same key
(string Source, string Target) GetEdgePair(string source, string target)
    => string.Compare(source, target, StringComparison.OrdinalIgnoreCase) <= 0
        ? (source, target) : (target, source);

void AddEdge(string source, string target, string label)
{
    if (source.Equals(target, StringComparison.OrdinalIgnoreCase)) return;
    var pair = GetEdgePair(source, target);
    var key  = (pair.Source, pair.Target, label);
    edgeWeights[key] = edgeWeights.TryGetValue(key, out var w) ? w + 1 : 1;
}
```

## Frontend

`KnowledgeGraphPage`, `ConceptPreviewModal`, `NotePreviewModal`, `knowledgeGraphService.ts`, and `d3` render and navigate the graph.
