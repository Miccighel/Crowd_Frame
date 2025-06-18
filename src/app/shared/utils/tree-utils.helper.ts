/* The node interface (adjust the generic if you store a richer model) */
export interface TreeNode<T = any> {
    model: T
    questions?: TreeNode<T>[]      // keep the same children property name
}

/* Depth-first walk – identical early-return semantics to tree-model */
export function walk<T>(
    node: TreeNode<T> | null | undefined,
    cb: (n: TreeNode<T>) => boolean | void,
    ctx?: any
): void {
    if (!node) return
    if (cb.call(ctx, node) === false) return
    node.questions?.forEach(child => walk(child, cb, ctx))
}

/* First node satisfying a predicate */
export function first<T>(
    node: TreeNode<T>,
    pred: (n: TreeNode<T>) => boolean
): TreeNode<T> | null {
    let found: TreeNode<T> | null = null
    walk(node, n => {
        if (pred(n)) {
            found = n;
            return false
        }
    })
    return found
}

/* All nodes satisfying a predicate */
export function all<T>(
    node: TreeNode<T>,
    pred: (n: TreeNode<T>) => boolean
): TreeNode<T>[] {
    const res: TreeNode<T>[] = []
    walk(node, n => {
        if (pred(n)) res.push(n)
    })
    return res
}

/* Add a deep-cloned child under parent */
export function addChild<T>(parent: TreeNode<T>, child: TreeNode<T>): void {
    (parent.questions ??= []).push(structuredClone(child))
}

/* Remove node from tree (returns true if removed) */
export function drop<T>(root: TreeNode<T>, node: TreeNode<T>): boolean {
    let removed = false
    walk(root, parent => {
        if (parent.questions) {
            const idx = parent.questions.indexOf(node)
            if (idx > -1) {
                parent.questions.splice(idx, 1)
                removed = true
                return false          // stop walking
            }
        }
    })
    return removed
}
