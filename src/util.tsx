/**
 * Legacy code. Should avoid to use if you are new to import these code.
 */

import React from 'react';
import warning from 'rc-util/lib/warning';
import TreeNode, { TreeNodeProps } from './TreeNode';
import { NodeElement, Key, DataNode, Entity, DataEntity, NodeInstance } from './interface';
import { TreeProps } from './Tree';

const DRAG_SIDE_RANGE = 0.25;
const DRAG_MIN_GAP = 2;

export function arrDel(list: Key[], value: Key) {
  const clone = list.slice();
  const index = clone.indexOf(value);
  if (index >= 0) {
    clone.splice(index, 1);
  }
  return clone;
}

export function arrAdd(list: Key[], value: Key) {
  const clone = list.slice();
  if (clone.indexOf(value) === -1) {
    clone.push(value);
  }
  return clone;
}

export function posToArr(pos: string) {
  return pos.split('-');
}

export function getPosition(level: string | number, index: number) {
  return `${level}-${index}`;
}

export function isTreeNode(node: NodeElement) {
  return node && node.type && node.type.isTreeNode;
}

export function getDragNodesKeys(dragNodeKey: Key, keyEntities: Record<Key, DataEntity>): Key[] {
  // not contains self
  // for left or right drag
  const dragNodesKeys = [];

  const entity = keyEntities[dragNodeKey];
  function dig(list: DataEntity[] = []) {
    list.forEach(({ key, children }) => {
      dragNodesKeys.push(key);
      dig(children);
    });
  }

  dig(entity.children);

  return dragNodesKeys;
}

function getEntity (treeNode: NodeInstance): DataEntity {
  return ((treeNode.props as any).context.keyEntities as any)[treeNode.props.eventKey]
}

// Only used when drag, not affect SSR.
export function calcDropPosition(event: React.MouseEvent, targetNode: NodeInstance) {
  const { clientX, clientY } = event;
  const { top, bottom, height, left: selectHandleX } = targetNode.selectHandle.getBoundingClientRect();
  const des = Math.max(height * DRAG_SIDE_RANGE, DRAG_MIN_GAP);
  const horizontalMouseOffset = selectHandleX - clientX
  const levelToAscend = horizontalMouseOffset / 18

  // console.log('levelToAscend', levelToAscend)

  let targetContainerNodeEntity: DataEntity | null = getEntity(targetNode).parent || null
  let targetSiblingNodeEntity: DataEntity = getEntity(targetNode)
  let levelAscended = 0
  if (targetContainerNodeEntity) {
    for (let i = 0; i < levelToAscend; ++i) {
      levelAscended += 1
      if (targetContainerNodeEntity?.parent) {
        targetContainerNodeEntity = targetContainerNodeEntity.parent
        targetSiblingNodeEntity = targetSiblingNodeEntity.parent
      } else {
        targetContainerNodeEntity = null
        targetSiblingNodeEntity = targetSiblingNodeEntity.parent
        break
      }
    }
  }

  let ret = [0]

  if (levelAscended === 0) {
    if (clientY <= top + des) {
      ret = [-1];
    }

    if (clientY >= bottom - des) {
      ret = [1];
    }
  } else {
    ret = [-1];
  }

  return [...ret, levelAscended, targetContainerNodeEntity, targetSiblingNodeEntity] as [-1 | 0 | 1, number, DataEntity, DataEntity]
}

/**
 * Return selectedKeys according with multiple prop
 * @param selectedKeys
 * @param props
 * @returns [string]
 */
export function calcSelectedKeys(selectedKeys: Key[], props: TreeProps) {
  if (!selectedKeys) return undefined;

  const { multiple } = props;
  if (multiple) {
    return selectedKeys.slice();
  }

  if (selectedKeys.length) {
    return [selectedKeys[0]];
  }
  return selectedKeys;
}

const internalProcessProps = (props: DataNode): Partial<TreeNodeProps> => props;
export function convertDataToTree(
  treeData: DataNode[],
  processor?: { processProps: (prop: DataNode) => any },
): NodeElement[] {
  if (!treeData) return [];

  const { processProps = internalProcessProps } = processor || {};
  const list = Array.isArray(treeData) ? treeData : [treeData];
  return list.map(
    ({ children, ...props }): NodeElement => {
      const childrenNodes = convertDataToTree(children, processor);

      return <TreeNode {...processProps(props)}>{childrenNodes}</TreeNode>;
    },
  );
}

// TODO: ========================= NEW LOGIC =========================
interface Wrapper {
  posEntities: Record<string, Entity>;
  keyEntities: Record<Key, Entity>;
}

/**
 * Parse `checkedKeys` to { checkedKeys, halfCheckedKeys } style
 */
export function parseCheckedKeys(keys: Key[] | { checked: Key[]; halfChecked: Key[] }) {
  if (!keys) {
    return null;
  }

  // Convert keys to object format
  let keyProps;
  if (Array.isArray(keys)) {
    // [Legacy] Follow the api doc
    keyProps = {
      checkedKeys: keys,
      halfCheckedKeys: undefined,
    };
  } else if (typeof keys === 'object') {
    keyProps = {
      checkedKeys: keys.checked || undefined,
      halfCheckedKeys: keys.halfChecked || undefined,
    };
  } else {
    warning(false, '`checkedKeys` is not an array or an object');
    return null;
  }

  return keyProps;
}

/**
 * If user use `autoExpandParent` we should get the list of parent node
 * @param keyList
 * @param keyEntities
 */
export function conductExpandParent(keyList: Key[], keyEntities: Record<Key, DataEntity>): Key[] {
  const expandedKeys = new Set<Key>();

  function conductUp(key: Key) {
    if (expandedKeys.has(key)) return;

    const entity = keyEntities[key];
    if (!entity) return;

    expandedKeys.add(key);

    const { parent, node } = entity;

    if (node.disabled) return;

    if (parent) {
      conductUp(parent.key);
    }
  }

  (keyList || []).forEach(key => {
    conductUp(key);
  });

  return [...expandedKeys];
}

/**
 * Returns only the data- and aria- key/value pairs
 */
export function getDataAndAria(props: Partial<TreeProps | TreeNodeProps>) {
  const omitProps: Record<string, string> = {};
  Object.keys(props).forEach(key => {
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      omitProps[key] = props[key];
    }
  });

  return omitProps;
}
