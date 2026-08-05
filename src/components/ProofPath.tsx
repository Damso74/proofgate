import type { PathNode } from "../engine";

/**
 * Graphe de preuve. `reached` et `halted` viennent du moteur : l'animation ne
 * décide de rien, elle ne fait que révéler progressivement des faits calculés.
 */
export function ProofPath({ nodes, revealed }: { nodes: PathNode[]; revealed: number }) {
  return (
    <div className="path" data-testid="proof-path">
      {nodes.map((node, index) => {
        const visible = index < revealed;
        const on = visible && node.reached && node.tone === "ok";
        const halt = visible && node.tone === "stop";
        const skip = visible && !node.reached;
        return (
          <div key={node.key} style={{ display: "contents" }}>
            {index > 0 ? (
              <div
                className="link"
                data-on={index < revealed && nodes[index - 1]!.reached && !nodes[index - 1]!.halted ? "1" : "0"}
                data-halt={nodes[index - 1]!.halted && index < revealed ? "1" : "0"}
              />
            ) : null}
            <div
              className="node"
              data-testid={`node-${node.key}`}
              data-on={on ? "1" : "0"}
              data-halt={halt ? "1" : "0"}
              data-skip={skip ? "1" : "0"}
              data-reached={node.reached ? "1" : "0"}
            >
              <div className="n">{node.label}</div>
              <div className="s">{skip ? "Not executed" : node.sublabel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
