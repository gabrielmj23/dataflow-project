export type ExtensionCreate = {
  name: string;
  description: string;
  author: string;
  color: string;
};

export type ExtensionNodeGet = {
  id: string;
  name: string;
  description: string;
  code: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type ExtensionListItem = {
  id: string;
  name: string;
  description: string;
  color: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type ExtensionGet = ExtensionListItem & { nodes: ExtensionNodeGet[] };

export type ExtensionsSearchParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};
