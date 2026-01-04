import { CheckCircleOutlined, DeleteOutlined, PlusOutlined, WarningOutlined } from "@ant-design/icons";
import { useTranslate } from "@refinedev/core";
import { Button, Checkbox, Divider, Input, InputNumber, Select, Space, Table, Tag, Typography, message, Alert } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetExternalDBFilaments, type ExternalFilament } from "../../utils/queryExternalDB";
import { createFilamentFromExternal } from "../filaments/functions";
import { getAPIURL } from "../../utils/url";
import type { IFilament } from "../filaments/model";

const { Title, Paragraph, Text } = Typography;

interface SelectionState {
  [key: string]: boolean;
}

export function BulkImportFilaments(): React.ReactElement {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const { data: externalFilaments = [] } = useGetExternalDBFilaments();
  const [messageApi, contextHolder] = message.useMessage();
  const [internalFilaments, setInternalFilaments] = useState<IFilament[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);

  // Fetch all internal filaments to check for duplicates
  useEffect(() => {
    const fetchInternalFilaments = async () => {
      try {
        setLoadingInternal(true);
        const response = await fetch(`${getAPIURL()}/filament?limit=10000`);
        if (response.ok) {
          const data = await response.json();
          setInternalFilaments(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch internal filaments:", error);
      } finally {
        setLoadingInternal(false);
      }
    };

    fetchInternalFilaments();
  }, []);

  // Create a set of already imported external IDs for quick lookup
  const importedExternalIds = useMemo(() => {
    return new Set(internalFilaments.filter((f) => f.external_id).map((f) => f.external_id));
  }, [internalFilaments]);

  // State for filters and selection
  const [manufacturerFilter, setManufacturerFilter] = useState<string | undefined>();
  const [materialFilter, setMaterialFilter] = useState<string | undefined>();
  const [diameterFilter, setDiameterFilter] = useState<number>(1.75);
  const [minWeight, setMinWeight] = useState<number | null>(null);
  const [maxWeight, setMaxWeight] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selection, setSelection] = useState<SelectionState>({});
  const [importing, setImporting] = useState(false);

  // Get unique manufacturers and materials for filter dropdowns
  const manufacturers = useMemo(() => {
    const unique = new Set(externalFilaments.map((f) => f.manufacturer));
    return Array.from(unique).sort();
  }, [externalFilaments]);

  const materials = useMemo(() => {
    const unique = new Set(externalFilaments.map((f) => f.material));
    return Array.from(unique).sort();
  }, [externalFilaments]);

  const diameters = useMemo(() => {
    const unique = new Set(externalFilaments.map((f) => f.diameter));
    return Array.from(unique).sort((a, b) => a - b);
  }, [externalFilaments]);

  // Filter filaments based on selection criteria and exclude already imported ones
  const filteredFilaments = useMemo(() => {
    return externalFilaments
      .filter((filament) => !importedExternalIds.has(filament.id)) // Exclude already imported
      .filter((filament) => {
        const matchesManufacturer = !manufacturerFilter || filament.manufacturer === manufacturerFilter;
        const matchesMaterial = !materialFilter || filament.material === materialFilter;
        const matchesDiameter = filament.diameter === diameterFilter;
        const matchesSearch =
          !searchText ||
          filament.name.toLowerCase().includes(searchText.toLowerCase()) ||
          filament.manufacturer.toLowerCase().includes(searchText.toLowerCase());
        const matchesMinWeight = minWeight === null || filament.weight >= minWeight;
        const matchesMaxWeight = maxWeight === null || filament.weight <= maxWeight;

        return matchesManufacturer && matchesMaterial && matchesDiameter && matchesSearch && matchesMinWeight && matchesMaxWeight;
      });
  }, [externalFilaments, manufacturerFilter, materialFilter, diameterFilter, searchText, minWeight, maxWeight, importedExternalIds]);

  // Count already imported filaments
  const importedCount = externalFilaments.filter((f) => importedExternalIds.has(f.id)).length;

  // Count selected items
  const selectedCount = Object.values(selection).filter(Boolean).length;

  // Handle select all visible
  const handleSelectAll = (checked: boolean) => {
    const newSelection: SelectionState = { ...selection };
    if (checked) {
      filteredFilaments.forEach((f) => {
        newSelection[f.id] = true;
      });
    } else {
      filteredFilaments.forEach((f) => {
        delete newSelection[f.id];
      });
    }
    setSelection(newSelection);
  };

  // Handle individual selection
  const handleSelectFilament = (filamentId: string, checked: boolean) => {
    const newSelection = { ...selection };
    if (checked) {
      newSelection[filamentId] = true;
    } else {
      delete newSelection[filamentId];
    }
    setSelection(newSelection);
  };

  // Handle bulk import
  const handleBulkImport = async () => {
    const selectedFilaments = filteredFilaments.filter((f) => selection[f.id]);

    if (selectedFilaments.length === 0) {
      messageApi.warning(t("notifications.selectAtLeastOne") || "Please select at least one filament");
      return;
    }

    setImporting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const filament of selectedFilaments) {
        try {
          await createFilamentFromExternal(filament);
          successCount++;
        } catch (error) {
          failCount++;
          console.error(`Failed to import ${filament.name}:`, error);
        }
      }

      if (failCount === 0) {
        messageApi.success(
          t("notifications.importSuccessful", { count: successCount }) || `Successfully imported ${successCount} filaments`
        );
        // Clear selection after successful import
        setSelection({});
      } else {
        messageApi.warning(
          `${successCount} filaments imported successfully, ${failCount} failed`
        );
      }

      // Invalidate all filament-related queries to force refresh
      // Use a broader approach to catch all possible query keys
      await queryClient.invalidateQueries();
      
      // Also specifically invalidate the known keys
      await queryClient.invalidateQueries({ queryKey: ["filaments"] });
      await queryClient.invalidateQueries({ queryKey: ["filament"] });
      
      // Refresh internal filaments list
      const response = await fetch(`${getAPIURL()}/filament?limit=10000`);
      if (response.ok) {
        const data = await response.json();
        setInternalFilaments(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Bulk import error:", error);
      messageApi.error(
        error instanceof Error ? error.message : t("notifications.importFailed") || "Import failed"
      );
    } finally {
      setImporting(false);
    }
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelection({});
  };

  // Clear all filters
  const handleClearFilters = () => {
    setManufacturerFilter(undefined);
    setMaterialFilter(undefined);
    setDiameterFilter(1.75);
    setMinWeight(null);
    setMaxWeight(null);
    setSearchText("");
  };

  const columns: ColumnsType<ExternalFilament> = [
    {
      title: (
        <Checkbox
          checked={selectedCount === filteredFilaments.length && filteredFilaments.length > 0}
          indeterminate={selectedCount > 0 && selectedCount < filteredFilaments.length}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: "checkbox",
      width: 50,
      render: (_: unknown, record: ExternalFilament) => (
        <Checkbox
          checked={selection[record.id] || false}
          onChange={(e) => handleSelectFilament(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: t("filament.fields.vendor_name"),
      dataIndex: "manufacturer",
      key: "manufacturer",
      width: 150,
      render: (manufacturer: string) => <Tag>{manufacturer}</Tag>,
    },
    {
      title: t("filament.fields.name"),
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: t("filament.fields.material"),
      dataIndex: "material",
      key: "material",
      width: 100,
      render: (material: string) => <Tag color="blue">{material}</Tag>,
    },
    {
      title: t("filament.fields.density"),
      dataIndex: "density",
      key: "density",
      width: 80,
      render: (density: number) => `${density.toFixed(2)} g/cm³`,
    },
    {
      title: t("filament.fields.weight"),
      dataIndex: "weight",
      key: "weight",
      width: 80,
      render: (weight: number) => `${weight}g`,
    },
    {
      title: t("filament.fields.diameter"),
      dataIndex: "diameter",
      key: "diameter",
      width: 80,
      render: (diameter: number) => `${diameter}mm`,
    },
  ];

  return (
    <>
      {contextHolder}
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <Title level={4}>{t("settings.importexport.bulkImportFilaments.title")}</Title>
        <Paragraph>
          {t("settings.importexport.bulkImportFilaments.description")}
        </Paragraph>

        {importedCount > 0 && (
          <Alert
            message={`${importedCount} ${t("notifications.filaments")} already imported`}
            description="These filaments are automatically excluded from the list below to prevent duplicates."
            type="info"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginBottom: "16px" }}
          />
        )}

        <Divider />

        {/* Filter Section */}
        <Title level={5}>{t("buttons.filter")}</Title>
        <Space style={{ marginBottom: 16, display: "flex", flexWrap: "wrap" }} size="middle">
          <Input
            placeholder={t("filament.fields.name") || "Search by name or manufacturer..."}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            placeholder={t("filament.fields.vendor_name") || "Filter by manufacturer"}
            allowClear
            value={manufacturerFilter}
            onChange={setManufacturerFilter}
            options={manufacturers.map((m) => ({ label: m, value: m }))}
            style={{ width: 200 }}
          />
          <Select
            placeholder={t("filament.fields.material") || "Filter by material"}
            allowClear
            value={materialFilter}
            onChange={setMaterialFilter}
            options={materials.map((m) => ({ label: m, value: m }))}
            style={{ width: 150 }}
          />
          <Select
            value={diameterFilter}
            onChange={setDiameterFilter}
            options={diameters.map((d) => ({ label: `${d}mm`, value: d }))}
            style={{ width: 120 }}
          />
          <InputNumber
            placeholder={`${t("filament.fields.weight")} ${t("buttons.min")}`}
            value={minWeight}
            onChange={setMinWeight}
            min={0}
            step={100}
            style={{ width: 140 }}
          />
          <InputNumber
            placeholder={`${t("filament.fields.weight")} ${t("buttons.max")}`}
            value={maxWeight}
            onChange={setMaxWeight}
            min={0}
            step={100}
            style={{ width: 140 }}
          />
          <Button onClick={handleClearFilters}>{t("buttons.clearFilters")}</Button>
        </Space>

        <Divider />

        {/* Selection Info and Actions */}
        <Space style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", width: "100%" }}>
          <Space>
            <CheckCircleOutlined style={{ fontSize: "16px" }} />
            <Text strong>
              {selectedCount} {t("buttons.show")} {filteredFilaments.length} filaments
            </Text>
          </Space>
          <Space>
            {selectedCount > 0 && (
              <Button icon={<DeleteOutlined />} onClick={handleClearSelection}>
                {t("buttons.clear")}
              </Button>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleBulkImport}
              loading={importing}
              disabled={selectedCount === 0}
            >
              {t("buttons.import")} {selectedCount > 0 ? `(${selectedCount})` : ""}
            </Button>
          </Space>
        </Space>

        {/* Filaments Table */}
        <Table
          columns={columns}
          dataSource={filteredFilaments}
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 1000 }}
          loading={externalFilaments.length === 0 || loadingInternal}
          locale={{
            emptyText: filteredFilaments.length === 0 && externalFilaments.length > 0 
              ? t("settings.importexport.bulkImportFilaments.noResults")
              : t("settings.importexport.bulkImportFilaments.noFilaments"),
          }}
        />
      </div>
    </>
  );
}
