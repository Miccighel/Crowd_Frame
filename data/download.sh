echo "Downloading task configuration and results from folder: ${2}/${1}/ to folder ${3}";
aws s3 sync "s3://${2}/${1}/" "${3}";
echo "Download completed ";
