namespace StudyPlatform.Application.ConceptLinks;

/// <summary>
/// Multi-pattern substring search (Aho–Corasick) for finding which known concepts appear in a body
/// of text. Built once per request from the user's glossary concepts, then run once per note/quiz —
/// replacing an O(concepts × texts) nested substring scan (for a heavy user, 300 notes + 600 quizzes
/// against hundreds of concepts is ~450K `Contains()` calls) with a single O(text length) pass per
/// text. Matching is case-insensitive substring containment, same semantics as the
/// `text.Contains(concept, StringComparison.OrdinalIgnoreCase)` check it replaces.
/// </summary>
public sealed class ConceptMatcher
{
    private sealed class Node
    {
        public readonly Dictionary<char, Node> Children = new();
        public Node Fail = null!;
        public List<string>? ConceptIds;
    }

    private readonly Node _root;

    public ConceptMatcher(IEnumerable<KeyValuePair<string, string>> concepts)
    {
        _root = new Node();
        _root.Fail = _root;

        foreach (var (phrase, conceptId) in concepts)
        {
            var normalized = phrase.ToLowerInvariant();
            if (normalized.Length < 3) continue;

            var node = _root;
            foreach (var ch in normalized)
            {
                if (!node.Children.TryGetValue(ch, out var next))
                {
                    next = new Node();
                    node.Children[ch] = next;
                }
                node = next;
            }
            (node.ConceptIds ??= new List<string>()).Add(conceptId);
        }

        BuildFailureLinks();
    }

    private void BuildFailureLinks()
    {
        var queue = new Queue<Node>();
        foreach (var child in _root.Children.Values)
        {
            child.Fail = _root;
            queue.Enqueue(child);
        }

        while (queue.Count > 0)
        {
            var node = queue.Dequeue();
            foreach (var (ch, child) in node.Children)
            {
                var fail = node.Fail;
                while (fail != _root && !fail.Children.ContainsKey(ch))
                    fail = fail.Fail;

                child.Fail = fail.Children.TryGetValue(ch, out var target) && target != child ? target : _root;
                queue.Enqueue(child);
            }
        }
    }

    /// <summary>Distinct concept ids whose phrase occurs anywhere in <paramref name="text"/>.</summary>
    public IEnumerable<string> FindConcepts(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) yield break;

        HashSet<string>? found = null;
        var node = _root;
        foreach (var ch in text.ToLowerInvariant())
        {
            while (node != _root && !node.Children.ContainsKey(ch))
                node = node.Fail;
            node = node.Children.TryGetValue(ch, out var next) ? next : _root;

            var trace = node;
            while (trace != _root)
            {
                if (trace.ConceptIds != null)
                {
                    foreach (var id in trace.ConceptIds)
                    {
                        found ??= new HashSet<string>();
                        if (found.Add(id)) yield return id;
                    }
                }
                trace = trace.Fail;
            }
        }
    }
}
