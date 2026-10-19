import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import BooksPage from "./pages/BooksPage";
import BookDetailPage from "./pages/BookDetailPage";
import CataloguePage from "./pages/CataloguePage";
import CatalogueEntryPage from "./pages/CatalogueEntryPage";

/* LB-03: the staff view (/library/books) and the browse view everyone has (/library/catalogue) */
export const routes: RouteObject[] = [
  { path: "/library/books", element: <RequirePermission permission="library.books.read"><BooksPage /></RequirePermission> },
  { path: "/library/books/:bookId", element: <RequirePermission permission="library.books.read"><BookDetailPage /></RequirePermission> },
  { path: "/library/catalogue", element: <RequirePermission permission="library.books.browse"><CataloguePage /></RequirePermission> },
  { path: "/library/catalogue/:bookId", element: <RequirePermission permission="library.books.browse"><CatalogueEntryPage /></RequirePermission> }
];
