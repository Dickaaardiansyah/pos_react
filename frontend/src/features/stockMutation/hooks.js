// src/features/stockMutation/hooks.js
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { stockMutationApi } from "./api";
import { productsApi } from "../products/api";
import { queryKeys } from "../../lib/queryClient";

function firstDayOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}
function today() {
  return new Date().toISOString().split("T")[0];
}

export function useStockMutation() {
  const [startDate, setStartDateRaw] = useState(firstDayOfThisMonth());
  const [endDate, setEndDateRaw] = useState(today());
  const [productId, setProductIdRaw] = useState("");
  const [jenis, setJenisRaw] = useState("");
  const [page, setPage] = useState(1);

  const filters = { startDate, endDate, productId, jenis };

  const mutationsQuery = useQuery({
    queryKey: queryKeys.stockMutations({ ...filters, page }),
    queryFn: () =>
      stockMutationApi.list({
        start_date: startDate,
        end_date: endDate,
        product_id: productId || undefined,
        jenis: jenis || undefined,
        page,
        limit: 25,
      }),
  });
  const summaryQuery = useQuery({
    queryKey: ["stock-mutations", "summary", filters],
    queryFn: () =>
      stockMutationApi.getSummary({
        start_date: startDate,
        end_date: endDate,
        product_id: productId || undefined,
      }),
  });
  const jenisQuery = useQuery({
    queryKey: ["stock-mutations", "jenis"],
    queryFn: () => stockMutationApi.listJenis(),
  });
  const productsQuery = useQuery({
    queryKey: queryKeys.products(),
    queryFn: () => productsApi.list(),
  });

  function resetFilters() {
    setStartDateRaw(firstDayOfThisMonth());
    setEndDateRaw(today());
    setProductIdRaw("");
    setJenisRaw("");
    setPage(1);
  }

  function reload() {
    mutationsQuery.refetch();
    summaryQuery.refetch();
  }

  return {
    startDate,
    setStartDate: (v) => {
      setStartDateRaw(v);
      setPage(1);
    },
    endDate,
    setEndDate: (v) => {
      setEndDateRaw(v);
      setPage(1);
    },
    productId,
    setProductId: (v) => {
      setProductIdRaw(v);
      setPage(1);
    },
    jenis,
    setJenis: (v) => {
      setJenisRaw(v);
      setPage(1);
    },
    page,
    setPage,
    mutations: mutationsQuery.data?.data ?? [],
    total: mutationsQuery.data?.total ?? 0,
    summary: summaryQuery.data?.data?.byType ?? [],
    jenisOptions: jenisQuery.data?.data ?? [],
    products: productsQuery.data?.data ?? [],
    loading:
      mutationsQuery.isLoading ||
      summaryQuery.isLoading ||
      jenisQuery.isLoading ||
      productsQuery.isLoading,
    resetFilters,
    reload,
  };
}
