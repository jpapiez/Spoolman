import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { useTranslate } from "@refinedev/core";
import { Button, Divider, Form, Radio, RadioChangeEvent, Typography, Upload, message } from "antd";
import type { RcFile, UploadProps } from "antd/es/upload";
import React, { useState } from "react";
import { getAPIURL } from "../../utils/url";

const { Title, Paragraph } = Typography;

export type ExportFormat = "csv" | "json";

interface ImportResponse {
  created: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function ImportExportSettings(): React.ReactElement {
  const t = useTranslate();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [loadingSpools, setLoadingSpools] = useState(false);
  const [loadingFilaments, setLoadingFilaments] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [importingSpools, setImportingSpools] = useState(false);
  const [importingFilaments, setImportingFilaments] = useState(false);
  const [importingVendors, setImportingVendors] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleExport = async (resource: "spools" | "filaments" | "vendors"): Promise<void> => {
    const setLoading = {
      spools: setLoadingSpools,
      filaments: setLoadingFilaments,
      vendors: setLoadingVendors,
    }[resource];

    try {
      setLoading(true);
      const response = await fetch(`${getAPIURL()}/export/${resource}?fmt=${format}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Get the filename based on the format
      const fileExtension = format === "csv" ? "csv" : "json";
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `${resource}-${timestamp}.${fileExtension}`;

      // Create a blob from the response
      const blob = await response.blob();

      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      messageApi.success(t("notifications.exportSuccessful"));
    } catch (error) {
      console.error("Export error:", error);
      messageApi.error(t("notifications.exportFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (resource: "spools" | "filaments" | "vendors", file: RcFile): Promise<void> => {
    const setLoading = {
      spools: setImportingSpools,
      filaments: setImportingFilaments,
      vendors: setImportingVendors,
    }[resource];

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${getAPIURL()}/import/${resource}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Import failed");
      }

      const result: ImportResponse = await response.json();

      // Show results message
      if (result.failed === 0) {
        messageApi.success(
          t("notifications.importSuccessful", {
            count: result.created,
          }),
        );
      } else {
        const errorList = result.errors.map((e) => `Row ${e.row}: ${e.error}`).join("\n");
        messageApi.warning(`${result.created} items imported successfully, ${result.failed} failed:\n${errorList}`);
      }
    } catch (error) {
      console.error("Import error:", error);
      messageApi.error(error instanceof Error ? error.message : t("notifications.importFailed"));
    } finally {
      setLoading(false);
    }
  };

  const createUploadProps = (resource: "spools" | "filaments" | "vendors"): UploadProps => ({
    maxCount: 1,
    accept: ".csv,.json",
    beforeUpload: (file) => {
      // Only allow CSV and JSON files
      const isValidType =
        file.type === "text/csv" ||
        file.type === "application/json" ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".json");
      if (!isValidType) {
        messageApi.error(t("notifications.invalidFileType"));
        return Upload.LIST_IGNORE;
      }
      return false; // Don't auto upload
    },
    onChange: async (info) => {
      if (info.file.status === "done" || info.fileList.length > 0) {
        const file = info.fileList[0];
        if (file && "originFileObj" in file && file.originFileObj) {
          await handleImport(resource, file.originFileObj as RcFile);
        }
      }
    },
  });

  return (
    <>
      {contextHolder}
      <Form
        labelCol={{ span: 10 }}
        wrapperCol={{ span: 14 }}
        style={{
          maxWidth: "520px",
          margin: "0 auto",
        }}
      >
        <Title level={4}>{t("settings.importexport.export.title")}</Title>
        <Paragraph>{t("settings.importexport.export.description")}</Paragraph>

        <Form.Item label={t("settings.importexport.export.format")}>
          <Radio.Group value={format} onChange={(e: RadioChangeEvent) => setFormat(e.target.value as ExportFormat)}>
            <Radio value="csv">CSV</Radio>
            <Radio value="json">JSON</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label={t("settings.importexport.export.spools")}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleExport("spools")}
            loading={loadingSpools}
            style={{ width: "240px" }}
          >
            {t("settings.importexport.export.export")}
          </Button>
        </Form.Item>

        <Form.Item label={t("settings.importexport.export.filaments")}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleExport("filaments")}
            loading={loadingFilaments}
            style={{ width: "240px" }}
          >
            {t("settings.importexport.export.export")}
          </Button>
        </Form.Item>

        <Form.Item label={t("settings.importexport.export.vendors")}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleExport("vendors")}
            loading={loadingVendors}
            style={{ width: "240px" }}
          >
            {t("settings.importexport.export.export")}
          </Button>
        </Form.Item>

        <Divider />

        <Title level={4}>{t("settings.importexport.import.title")}</Title>
        <Paragraph>{t("settings.importexport.import.description")}</Paragraph>

        <Form.Item label={t("settings.importexport.import.spools")}>
          <Upload {...createUploadProps("spools")}>
            <Button icon={<UploadOutlined />} loading={importingSpools} style={{ width: "240px" }}>
              {t("settings.importexport.import.selectFile")}
            </Button>
          </Upload>
        </Form.Item>

        <Form.Item label={t("settings.importexport.import.filaments")}>
          <Upload {...createUploadProps("filaments")}>
            <Button icon={<UploadOutlined />} loading={importingFilaments} style={{ width: "240px" }}>
              {t("settings.importexport.import.selectFile")}
            </Button>
          </Upload>
        </Form.Item>

        <Form.Item label={t("settings.importexport.import.vendors")}>
          <Upload {...createUploadProps("vendors")}>
            <Button icon={<UploadOutlined />} loading={importingVendors} style={{ width: "240px" }}>
              {t("settings.importexport.import.selectFile")}
            </Button>
          </Upload>
        </Form.Item>
      </Form>
    </>
  );
}
