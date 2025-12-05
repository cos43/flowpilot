import { ensureRootXml } from "@/lib/utils";

/**
 * 将增量 <root> 补丁合并到现有的 mxGraphModel XML。
 * - patchRoot 需要是合法的 <root>...</root> 块（调用方负责确保）。
 * - 同 id 的 mxCell 覆盖，未存在的追加。
 * - 始终确保基础节点 0 / 1 存在。
 */
export function mergeRootPatch(baseXml: string, patchRoot: string): string {
    const safeBase = ensureMxGraphModel(baseXml);
    const parser = new DOMParser();
    const baseDoc = parser.parseFromString(safeBase, "text/xml");
    const patchDoc = parser.parseFromString(ensureRootXml(patchRoot), "text/xml");

    const baseRoot = baseDoc.querySelector("mxGraphModel > root");
    const patchRootEl = patchDoc.querySelector("root");
    if (!baseRoot || !patchRootEl) return safeBase;

    // 构建 id -> node 映射
    const baseMap = new Map<string, Element>();
    Array.from(baseRoot.children).forEach((el) => {
        const id = el.getAttribute("id");
        if (id) baseMap.set(id, el);
    });

    // 确保基础节点 0 / 1
    ensureBaseCells(baseRoot, baseMap);

    // 合并补丁
    Array.from(patchRootEl.children).forEach((el) => {
        const id = el.getAttribute("id");
        if (!id) return;
        const existing = baseMap.get(id);
        if (existing) {
            existing.replaceWith(el.cloneNode(true));
        } else {
            baseRoot.appendChild(el.cloneNode(true));
        }
        baseMap.set(id, el);
    });

    return new XMLSerializer().serializeToString(baseDoc);
}

function ensureMxGraphModel(xml: string): string {
    if (!xml || !xml.trim()) {
        return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>`;
    }
    const trimmed = xml.trim();
    if (!trimmed.includes("<mxGraphModel")) {
        return `<mxGraphModel>${ensureRootXml(trimmed)}</mxGraphModel>`;
    }
    return trimmed;
}

function ensureBaseCells(baseRoot: Element, baseMap: Map<string, Element>) {
    if (!baseMap.has("0")) {
        const cell0 = baseRoot.ownerDocument.createElement("mxCell");
        cell0.setAttribute("id", "0");
        baseRoot.prepend(cell0);
        baseMap.set("0", cell0);
    }
    if (!baseMap.has("1")) {
        const cell1 = baseRoot.ownerDocument.createElement("mxCell");
        cell1.setAttribute("id", "1");
        cell1.setAttribute("parent", "0");
        baseRoot.appendChild(cell1);
        baseMap.set("1", cell1);
    }
}



